require('dotenv').config()
const request = require('request-promise')
const mongoose = require('mongoose')
const cheerio = require('cheerio')
const housecall = require("housecall");
const Products = require('./models/product')
const Config = require('./models/config')
let _ = require('lodash');
let que = require('./queue.js')
let date = new Date()
let dateFormat = `${date.getFullYear()}-${date.getDay()}-${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
let queue = housecall({
  concurrency: 1,
  cooldown: 750
});

Config.watch().on('change', async d=>{
  if(d.operationType === 'update')
  {
    let config = await Config.findOne()
    if(config)
    {
      kwSets = config.keywords
      proxies = config.proxies
      filtered = config.filtered
      unfiltered = config.unfiltered
    }
  }
})

const mongoserver = process.env.MONGO_SERVER
const db = process.env.MONGO_DB
mongoose.connect(`mongodb://${mongoserver}/${db}`, {
  useNewUrlParser: true,
  useCreateIndex: true
}, async (err,cl)=>{
  if(err) return
  let config = await Config.findOne()
  if(config)
  {
    kwSets = config.keywords
    proxies = config.proxies
    filtered = config.filtered
    unfiltered = config.unfiltered
    await startmonitor2()
  }
})
mongoose.Promise = global.Promise;


let brands = {
  '1840': 'adidas_originals',
  '1051': 'nike',
  '1212': 'new_balance',
  '2606': 'off_white'
}

let kwSets = []
let proxies = []
let filtered = []
let unfiltered = []

// var webHookURL = process.env.WEBHOOK
var errorHook = process.env.ERRORHOOK

function sendDicordWebhook(emb, webHookURL) {
  try{
    queue.push(async () => {
      try
      {
        await request.post(webHookURL,{
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emb)
        });
      }
      catch(err)
      {
        sendDicordWebhook(emb, webHookURL)
      }
    })
  }
  catch(err)
  {
    console.log(err)
  }
}

function sendFilteredDicordWebhook(embedData) {
  try{
      for(let j = 0; j < filtered.length; ++j)
      {
        let e = _.cloneDeep(embedData)
        e.avatar_url = filtered[j].logo
        e.embeds[0].footer.icon_url = filtered[j].logo
        e.embeds[0].color = parseInt(filtered[j].color)

        sendDicordWebhook(e, filtered[j].webhook)
      }
  }
  catch(err)
  {
    console.log(err)
  }
}

function sendUnfilteredDicordWebhook(embedData) {
  try{
    for(let i = 0; i < unfiltered.length; ++i)
    {
      let e = _.cloneDeep(embedData)
      e.avatar_url = unfiltered[i].logo
      e.embeds[0].footer.icon_url = unfiltered[i].logo
      e.embeds[0].color = parseInt(unfiltered[i].color)
      
      sendDicordWebhook(e, unfiltered[i].webhook)
      
    }
  }
  catch(err)
  {
    console.log(err)
  }
}

function sendErrorWebhook(embedData) {
  try{
      queue.push(async () => {
        try
        {
          await request.post(errorHook,{
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(emb)
          });
        }
        catch(err)
        {
          sendErrorWebhook(embedData)
        }
      });
  }
  catch(err)
  {
    console.log(err)
  }
}

function startmonitor() {
  setTimeout(async function () {
    try{
      let proxy = proxies.shift()
      proxies.push(proxy)
      console.log(proxy)
      let rawProducts = await getProductsAPI(proxy)
      for(let i in rawProducts)
      {

        if(i % 5 === 0)
        {
          proxy = proxies.shift()
          proxies.push(proxy)
          console.log(proxy)
        }
        let found = await Products.findOne({productID: rawProducts[i].id, productName: rawProducts[i].name})
        let cleanedProduct = await cleanProduct(rawProducts[i], proxy)
        if(found)
        {
          // Check for restocks
          let restocked = false
          let foundSizes = JSON.parse(JSON.stringify(found.productSizes))
          for(let i in foundSizes)
          {
            if(foundSizes[i].stockLevel === 'Out_of_Stock' && cleanedProduct.productSizes[i].stockLevel !== 'Out_of_Stock')
            {
              restocked = true
              break;
            }
          }
          if(restocked)
          {
            found.productSizes = cleanedProduct.productSizes
            await found.save()
            let emb = buildRestocked(cleanedProduct)
            await sendDicordWebhook(emb)
          }
        }
        else
        {
          // Save product and push notif
          let newProduct = new Products(cleanedProduct)
          await newProduct.save()
          let emb = buildNewProduct(cleanedProduct) 
          await sendDicordWebhook(emb)
        }
      }
      startmonitor()
    }
    catch(err)
    {
      if(err.statusCode)
      {
        let e = buildError(`Main process: ${err.statusCode}`)
        await sendErrorWebhook(e)
      }
      else
      {
        let e = buildError(`Main process: ${err}`)
        console.log(e)
        await sendErrorWebhook(e)
      }
      startmonitor()
    }
  }, 1500 )
}

async function getProducts()
{
  try
  {
    let res = await request({
      url: 'https://www.net-a-porter.com/us/en/d/Shop/Shoes/All?view=partial&cm_sp=topnav-_-shoes-_-allshoes&pn=1&npp=60&image_view=product&dScroll=0&sortorder=new-in',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'
      },
      resolveWithFullResponse: true,
      followAllRedirects: true
    })
    
    let $ = cheerio.load(res.body)

  }
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`GetProducts: ${err.statusCode}`)
      await sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`GetProducts: ${err}`)
      await sendErrorWebhook(e)
    }
  }
}

async function getProductsAPI(proxy)
{
  try
  {
    let proxyParts = proxy.split(':')
    let agent 
    if(proxyParts[2] && proxyParts[3])
    {
      agent = "http://" + proxyParts[2] + ':' + proxyParts[3] + '@' + proxyParts[0] + ':' + proxyParts[1]
    }
    else
    {
      agent = "http://" + proxyParts[0] + ':' + proxyParts[1]
    }
    let res = await request({
      url: 'https://api.net-a-porter.com/NAP/GB/en/1600/0/summaries?brandIds=1051,1212,1840,2606&whatsNew=Now',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'
      },
      proxy: agent,
      resolveWithFullResponse: true,
      followAllRedirects: true
    })
    let products = JSON.parse(res.body).summaries
    
    return products  
  }
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`GetProducts GB: ${err.statusCode}`)
      await sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`GetProducts GB: ${err}`)
      await sendErrorWebhook(e)
    }
  }
}

async function cleanProduct(product, proxy)
{
  try
  {
    let productID = product.id
    let price = product.price.amount / product.price.divisor
    let image = `https://cache.net-a-porter.com/images/products/${productID}/${productID}_in_pp.jpg`
    let brandName = brands[product.brandId]
    let pl = product.name.toLowerCase().split(' ')
    pl = pl.join('-')
    let pLink = `https://net-a-porter.com/gb/en/product/${productID}/${brandName}/${pl}`
    pLink = pLink.replace(/\+/g, "-")
    pLink = pLink.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    let rawSizeData = await getSizes(pLink, proxy)
    let cleanSizes = []
    if(rawSizeData)
    {
      for(let j in rawSizeData)
      {
        let atcLink = `https://www.net-a-porter.com/gb/en/api/basket/addskus/${rawSizeData[j].id}.json`
        cleanSizes.push({
          atcLink,
          stockLevel: rawSizeData[j].stockLevel,
          sizeName: rawSizeData[j].displaySize
        })
      }
      return {
        productName: product.name,
        productID,
        productPrice: price,
        productURL: pLink,
        productImage: image,
        productSizes: cleanSizes
      }
    }
    else
    {
      return undefined
    }   
  }
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`CleanProducts GB: ${err.statusCode}`)
      await sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`CleanProducts GB: ${err}`)
      console.log(e)
      await sendErrorWebhook(e)
    }
  }
}

async function getSizes(productURL, proxy)
{
  try
  {
    let proxyParts = proxy.split(':')
    let agent 
    if(proxyParts[2] && proxyParts[3])
    {
      agent = "http://" + proxyParts[2] + ':' + proxyParts[3] + '@' + proxyParts[0] + ':' + proxyParts[1]
    }
    else
    {
      agent = "http://" + proxyParts[0] + ':' + proxyParts[1]
    }
    let res = await request({
      url: productURL,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'
      },
      proxy: agent,
      resolveWithFullResponse: true,
      followAllRedirects: true
    })

    let $ = cheerio.load(res.body)
    let opt = $('div.sizing-container').find('select-dropdown').attr('options')
    if(opt)
    {
      opt = JSON.parse(opt)
      
      return opt
    }
    else
    {
      let stock = $('input.sku').attr('data-stock')
      let sku = $('input.sku').attr('value')
      if(stock && sku)
      {
        return [{
          stockLevel: stock,
          displaySize: 'One Size',
          id: sku,
          value: sku,
          name: 'One Size ',
          data: { size: 'One Size', stock: stock, moreComingSoon: '' }
        }]
      }
      else
      {
        return undefined
      }
    }
    
  }
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`GetSizes GB: ${err.statusCode}\n${productURL}`)
      await sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`GetSizes GB: ${err}\n${productURL}`)
      await sendErrorWebhook(e)
    }
  }
}

function buildNewProduct(product)
{
  try
  {
    let emb = {
      username: "Net-A-Porter",
      avatar_url: "https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128",
      embeds: [
        {
          title: `${product.productName}`,
          url: product.productURL,
          color: 0xFFFF33,
          thumbnail: {
            url: product.productImage
          },
          fields: [{
            name: 'Price',
            value: product.productPrice 
          }],
          footer: {
            icon_url:
              "https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128",
            text: "~Woof~#1001"
          },
          timestamp: new Date()
        }
      ]
    };

    let sizeFields = []
    let sizeFields2 = []
    let stockFields = []
    let stockFields2 = []
    let limit = 0
    for(let i in product.productSizes)
    {
      let f = `[${product.productSizes[i].sizeName}](${product.productSizes[i].atcLink})`
      if(limit < 850)
      {
        limit += f.length
        sizeFields.push(f)
        stockFields.push(product.productSizes[i].stockLevel)
      }
      else
      {
        sizeFields2.push(f)
        stockFields2.push(product.productSizes[i].stockLevel)
      }
    }

    emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields.join('\n'), inline: true})
    emb.embeds[0].fields.push({name: 'Stock Level', value: stockFields.join('\n'), inline: true})
    if(sizeFields2.length > 0)
    {
      emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields2.join('\n'), inline: true})
      emb.embeds[0].fields.push({name: 'Stock Level', value: stockFields2.join('\n'), inline: true})
    }
    return emb
  }
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`BuildNew GB: ${err.statusCode}\n${productURL}`)
      await sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`BuildNew GB: ${err}\n${productURL}`)
      await sendErrorWebhook(e)
    }
  }
}

function buildRestocked(product)
{
  try
  {
    let emb = {
      username: "Net-A-Porter",
      avatar_url: "https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128",
      embeds: [
        {
          title: `${product.productName} Restocked!`,
          url: product.productURL,
          color: 0xFFFF33,
          thumbnail: {
            url: product.productImage
          },
          fields: [{
            name: 'Price',
            value: product.productPrice 
          }],
          footer: {
            icon_url:
              "https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128",
            text: "~Woof~#1001"
          },
          timestamp: new Date()
        }
      ]
    };

    let sizeFields = []
    let sizeFields2 = []
    let stockFields = []
    let stockFields2 = []
    let limit = 0
    for(let i in product.productSizes)
    {
      let f = `[${product.productSizes[i].sizeName}](${product.productSizes[i].atcLink})`
      if(limit < 900)
      {
        limit += f.length
        sizeFields.push(f)
        stockFields.push(product.productSizes[i].stockLevel)
      }
      else
      {
        sizeFields2.push(f)
        stockFields2.push(product.productSizes[i].stockLevel)
      }
    }

    emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields.join('\n'), inline: true})
    emb.embeds[0].fields.push({name: 'Stock Level', value: stockFields.join('\n'), inline: true})
    if(sizeFields2.length > 0)
    {
      emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields2.join('\n'), inline: true})
      emb.embeds[0].fields.push({name: 'Stock Level', value: stockFields2.join('\n'), inline: true})
    }
    return emb
  }
  catch(err)
  {
    console.log(err)
  }
}

function buildError(error)
{
  try
  {
    let emb = {
      username: "Error!",
      avatar_url: "https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128",
      embeds: [
        {
          title: `FIX YOUR SHIT`,
          color: 0xFFFF33,
          description: error,
          footer: {
            icon_url:
              "https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128",
            text: "~Woof~#1001"
          },
          timestamp: new Date()
        }
      ]
    };
    return emb
  }
  catch(err)
  {
    console.log(err)
  }
}

async function getAllProductsAPI(proxy)
{
  try
  {
    let proxyParts = proxy.split(':')
    let agent 
    if(proxyParts[2] && proxyParts[3])
    {
      agent = "http://" + proxyParts[2] + ':' + proxyParts[3] + '@' + proxyParts[0] + ':' + proxyParts[1]
    }
    else
    {
      agent = "http://" + proxyParts[0] + ':' + proxyParts[1]
    }
    
    
    let res = await request({
      url: 'https://api.net-a-porter.com/NAP/GB/en/1600/0/summaries?brandIds=1051,1212,1840,2606',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'
      },
      proxy: agent,
      resolveWithFullResponse: true,
      followAllRedirects: true
    })
    let products = JSON.parse(res.body).summaries
    
    return products  
  }
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`GetProducts GB: ${err.statusCode}`)
      await sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`GetProducts GB: ${err}`)
      await sendErrorWebhook(e)
    }
  }
}

function startmonitor2() {
  setTimeout(async function () {
    try{
      if(proxies.length === 0)
      {
        console.log("Waiting on proxies")
        startmonitor2()
        return
      }
      let proxy = proxies.shift()
      let currPlist = proxies
      proxies.push(proxy)
      console.log(proxy)
      let rawProducts = await getAllProductsAPI(proxy)
      let matchedProducts = []
      //let cleaned = await cleanProduct(p[i], '')

      if(kwSets.length > 0)
      {
        for(let j = 0; j < kwSets.length; j++)
        {
          let kws = kwSets[j].split(',')
          let pkw = []
          let nkw = []
          let matchesAll = true;
          for(let k in kws)
          {
            if(kws[k].substring(0,1) === '+')
            {
              pkw.push(kws[k].substring(1,kws[k].length).toLowerCase())
            }
            else
            {
              nkw.push(kws[k].substring(1,kws[k].length).toLowerCase())
            }
            
          }
          
          for(let i in rawProducts)
          {
            for(let l in pkw)
            {
              let kw = pkw[l].toLowerCase();
              if(!rawProducts[i].name.toLowerCase().includes(kw))
              {
                matchesAll = false;
              }
            }
            if(matchesAll)
            {
              matchedProducts.push(rawProducts[i])
            }
          }
          for(let a in matchedProducts)
          {
            for(let b in nkw)
            {
              let kw = nkw[b].toLowerCase();
              if(matchedProducts[a].name.toLowerCase().includes(kw))
              {
                matchedProducts.splice(a, 1);
              }
            }
          }
        }
      }
      let cleanedProducts = []
      for(let pr in rawProducts)
      {
        proxy = currPlist.shift()
        currPlist.push(proxy)
        cleanedProducts.push(cleanProduct(rawProducts[pr], proxy))
      }
      cleanedProducts = await Promise.all(cleanedProducts)
      //let jobs = []
      for(let p in rawProducts)
      {
        let found = await Products.findOne({productID: rawProducts[p].id, productName: rawProducts[p].name})
        
        if(found)
        {
          let isMonitored = false
          for(let j in matchedProducts)
          {
            if(matchedProducts[j].name === found.productName)
            {
              isMonitored = true
            }
          }

          let cleanedProduct = JSON.parse(JSON.stringify(cleanedProducts[p]))
          
          if(cleanedProduct)
          {
            // Check for restocks
            let restocked = false
            let foundSizes = JSON.parse(JSON.stringify(found.productSizes))
            
            for(let i = 0; i < foundSizes.length; ++i)
            {
              for(let ci = 0; ci < cleanedProduct.productSizes.length; ++ci)
              {
                if(cleanedProduct.productSizes[ci].sizeName === foundSizes[i].sizeName)
                {
                  if(foundSizes[i].stockLevel === 'Out_of_Stock' && cleanedProduct.productSizes[ci].stockLevel !== 'Out_of_Stock')
                  {
                    restocked = true
                    break;
                  }
                }
              }
              
            }
            if(restocked)
            {
              found.productSizes = cleanedProduct.productSizes
              await found.save()
              
              let emb = buildRestocked(cleanedProduct)
              // for(let j = 0; j < unfiltered.length; ++j)
              // {
              //   emb.avatar_url = unfiltered[j].logo
              //   emb.embeds[0].footer.icon_url = unfiltered[j].logo
              //   emb.embeds[0].color = parseInt(unfiltered[j].color)
              //   jobs.push(request.post(unfiltered[j].webhook,{
              //     headers: {
              //       'Content-Type': 'application/json'
              //     },
              //     body: JSON.stringify(emb)
              //   }))
              // }
              await sendUnfilteredDicordWebhook(emb)
              //process.send({type: 'Restock', source: "Unfiltered" ,data: emb})
              if(isMonitored)
              {
                // for(let i = 0; i < unfiltered.length; ++i)
                // {
                //   emb.avatar_url = unfiltered[i].logo
                //   emb.embeds[0].footer.icon_url = unfiltered[i].logo
                //   emb.embeds[0].color = parseInt(unfiltered[i].color)
                //   jobs.push(request.post(unfiltered[i].webhook,{
                //     headers: {
                //       'Content-Type': 'application/json'
                //     },
                //     body: JSON.stringify(emb)
                //   }))
                // }
                //process.send({type: 'Restock', source: "Filtered", data: emb})
                await sendFilteredDicordWebhook(emb)
              }
            }
          }
        }
        else
        {
          let isMonitored = false
          for(let j in matchedProducts)
          {
            if(matchedProducts[j].name === rawProducts[p].name)
            {
              isMonitored = true
            }
          }
          let cleanedProduct = cleanedProducts[p]
          // Save product and push notif
          if(cleanedProduct)
          {
            let newProduct = new Products(cleanedProduct)
            await newProduct.save()
            
            let emb = buildNewProduct(cleanedProduct)
            // for(let j = 0; j < unfiltered.length; ++j)
            // {
            //   emb.avatar_url = unfiltered[j].logo
            //   emb.embeds[0].footer.icon_url = unfiltered[j].logo
            //   emb.embeds[0].color = parseInt(unfiltered[j].color)
            //   jobs.push(async ()=>( await request.post(unfiltered[j].webhook,{
            //     headers: {
            //       'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify(emb)
            //   })))
            // }
            
            await sendUnfilteredDicordWebhook(emb)
            //process.send({type: 'Restock', source: "Unfiltered" ,data: emb})
            if(isMonitored)
            {
              //process.send({type: 'Restock', source: "Filtered", data: emb})
              // for(let i = 0; i < unfiltered.length; ++i)
              // {
              //   emb.avatar_url = unfiltered[i].logo
              //   emb.embeds[0].footer.icon_url = unfiltered[i].logo
              //   emb.embeds[0].color = parseInt(unfiltered[i].color)
              //   jobs.push(request.post(unfiltered[i].webhook,{
              //     headers: {
              //       'Content-Type': 'application/json'
              //     },
              //     body: JSON.stringify(emb)
              //   }))
              // }
              await sendFilteredDicordWebhook(emb)
            }
          }
        }
      }
      // await que.enqueue(jobs, 1000)
      startmonitor2()
    }
    catch(err)
    {
      console.log(err)
      if(err.statusCode)
      {
        let e = buildError(`Main process GB: ${err.statusCode}`)
        await sendErrorWebhook(e)
      }
      else
      {
        let e = buildError(`Main process GB: ${err}`)
        await sendErrorWebhook(e)
      }
      startmonitor2()
    }
  }, 1500 )
}