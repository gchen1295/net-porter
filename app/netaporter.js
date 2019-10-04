require('dotenv').config()
const request = require('request-promise')
const mongoose = require('mongoose')
const cheerio = require('cheerio')
const housecall = require("housecall");
const Products = require('./models/product')
let Servers = require('./models/servers.js')
let date = new Date()
let dateFormat = `${date.getFullYear()}-${date.getDay()}-${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
let queue = housecall({
  concurrency: 1,
  cooldown: 1100
});

Servers.watch().on('change', d=>{console.log(d)})

mongoose.connect(`mongodb://127.0.0.1:27017/net-a-porter`, {
  useNewUrlParser: true,
  useCreateIndex: true
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

process.on('message', async data =>{
  if(data.type === 'start')
  {
    let server = await Servers.findOne({serverID: data.serverID})
    serverName = server.serverName
    proxies = server.proxies
    
    kwSets = server.keywords
    filteredOn = true
    startmonitor2()
  }
  // if(data.type === 'startUnfiltered')
  // {
  //   serverName = data.serverName
  //   startmonitor2()
  // }
  if(data.type === 'updateProxy')
  {
    proxies.concat(data.proxyList)
  }
  if(data.type === 'addKW')
  {
    kwSets.push(data.keywords)
  }
})

var webHookURL = process.env.WEBHOOK
var errorHook = process.env.ERRORHOOK

function sendDicordWebhook(embedData) {
  try{
      queue.push(() => {
        request.post(webHookURL,{
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(embedData)
        });
      });
  }
  catch(err)
  {
    console.log(err)
  }
}

function sendErrorWebhook(embedData) {
  try{
      queue.push(() => {
        request.post(errorHook,{
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(embedData)
        });
      });
  }
  catch(err)
  {
    console.log(err)
  }
}

//startmonitor()

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
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`CleanProducts: ${err.statusCode}`)
      await sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`CleanProducts: ${err}`)
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
      //proxy: agent,
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
      return {
        stockLevel: stock,
        displaySize: 'One Size',
        id: sku,
        value: sku,
        name: 'One Size ',
        data: { size: 'One Size', stock: stock, moreComingSoon: '' }
      }
    }
    
  }
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`GetSizes: ${err.statusCode}\n${productURL}`)
      await sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`GetSizes: ${err}\n${productURL}`)
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
      avatar_url: "https://i.gyazo.com/266204cae38a101aecf5e4cc072ca696.png",
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
              "https://i.gyazo.com/266204cae38a101aecf5e4cc072ca696.png",
            text: "~Woof~#1001"
          },
          timestamp: new Date()
        }
      ]
    };

    let sizeFields = []
    let stockFields = []
    for(let i in product.productSizes)
    {
      sizeFields.push(`[${product.productSizes[i].sizeName}](${product.productSizes[i].atcLink})`)
      stockFields.push(product.productSizes[i].stockLevel)
    }
    emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields.join('\n'), inline: true})
    emb.embeds[0].fields.push({name: 'Stock Level', value: stockFields.join('\n'), inline: true})
    return emb
  }
  catch(err)
  {
    console.log(err)
  }
}

function buildNewProductDiscord(product)
{
  try
  {
    let emb = 
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
              "https://i.gyazo.com/266204cae38a101aecf5e4cc072ca696.png",
            text: "~Woof~#1001"
          },
          timestamp: new Date()
        }

    let sizeFields = []
    let stockFields = []
    for(let i in product.productSizes)
    {
      sizeFields.push(`[${product.productSizes[i].sizeName}](${product.productSizes[i].atcLink})`)
      stockFields.push(product.productSizes[i].stockLevel)
    }
    emb.fields.push({name: 'Sizes', value: sizeFields.join('\n'), inline: true})
    emb.fields.push({name: 'Stock Level', value: stockFields.join('\n'), inline: true})
    return emb
  }
  catch(err)
  {
    console.log(err)
  }
}

function buildRestocked(product)
{
  try
  {
    let emb = {
      username: "Net-A-Porter",
      avatar_url: "https://i.gyazo.com/266204cae38a101aecf5e4cc072ca696.png",
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
              "https://i.gyazo.com/266204cae38a101aecf5e4cc072ca696.png",
            text: "~Woof~#1001"
          },
          timestamp: new Date()
        }
      ]
    };

    let sizeFields = []
    let stockFields = []
    for(let i in product.productSizes)
    {
      sizeFields.push(`[${product.productSizes[i].sizeName}](${product.productSizes[i].atcLink})`)
      stockFields.push(product.productSizes[i].stockLevel)
    }
    emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields.join('\n'), inline: true})
    emb.embeds[0].fields.push({name: 'Stock Level', value: stockFields.join('\n'), inline: true})
    return emb
  }
  catch(err)
  {
    console.log(err)
  }
}

function buildRestockedDiscord(product)
{
  try
  {
    let emb = 
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
              "https://i.gyazo.com/266204cae38a101aecf5e4cc072ca696.png",
            text: "~Woof~#1001"
          },
          timestamp: new Date()
        }
  

    let sizeFields = []
    let stockFields = []
    for(let i in product.productSizes)
    {
      sizeFields.push(`[${product.productSizes[i].sizeName}](${product.productSizes[i].atcLink})`)
      stockFields.push(product.productSizes[i].stockLevel)
    }
    emb.fields.push({name: 'Sizes', value: sizeFields.join('\n'), inline: true})
    emb.fields.push({name: 'Stock Level', value: stockFields.join('\n'), inline: true})
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
      avatar_url: "https://2static1.fjcdn.com/comments/I+figs+dis+me+mayk+u+nise+to+muma+u+_b8b3c240e1ea918170c0a00e5249f795.jpg",
      embeds: [
        {
          title: `FIX YOUR SHIT`,
          color: 0xFFFF33,
          description: error,
          footer: {
            icon_url:
              "https://2static1.fjcdn.com/comments/I+figs+dis+me+mayk+u+nise+to+muma+u+_b8b3c240e1ea918170c0a00e5249f795.jpg",
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
      //proxy: agent,
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

function startmonitor2() {
  setTimeout(async function () {
    try{
      if(proxies.length === 0)
      {
        process.send({type: 'Error', message: 'No proxies!'})
        return
      }
      let proxy = proxies.shift()
      proxies.push(proxy)
      console.log(proxy)
      let rawProducts = await getAllProductsAPI(proxy)
      let matchedProducts = []

      //let cleaned = await cleanProduct(p[i], '')

      if(kwSets.length > 0)
      {
        for(let j in kwSets)
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
      
      

      for(let i in rawProducts)
      {
        let found = await Products.findOne({productID: rawProducts[i].id, productName: rawProducts[i].name})
        let cleanedProduct
        if(found)
        {

          if(i % 5 === 0)
          {
            proxy = proxies.shift()
            proxies.push(proxy)
            console.log(proxy)
          }
          let isMonitored = false
          for(let i in matchedProducts)
          {
            if(matchedProducts[i].name === found.productName)
            {
              isMonitored = true
            }
          }
          cleanedProduct = await cleanProduct(rawProducts[i], proxy)
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
            
            let emb = buildRestockedDiscord(cleanedProduct)
            //await sendDicordWebhook(emb)
            process.send({type: 'Restock', source: "Unfiltered" ,data: emb})
            if(isMonitored)
            {
              process.send({type: 'Restock', source: "Filtered", data: emb})
            }
          }
        }
        else
        {
          if(i % 5 === 0)
          {
            proxy = proxies.shift()
            proxies.push(proxy)
          }
          let isMonitored = false
          for(let i in matchedProducts)
          {
            if(matchedProducts[i].name === rawProducts[i].name)
            {
              isMonitored = true
            }
          }
          cleanedProduct = await cleanProduct(rawProducts[i], proxy)
          // Save product and push notif
          let newProduct = new Products(cleanedProduct)
          await newProduct.save()
          
          let emb = buildNewProductDiscord(cleanedProduct) 
          //await sendDicordWebhook(emb)
          process.send({type: 'New Product', source: "Unfiltered", data: emb})
          if(isMonitored)
          {
            process.send({type: 'Restock', source: "Filtered", data: emb})
          }
        }
      }
      startmonitor2()
    }
    catch(err)
    {
      console.log(err)
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
      startmonitor2()
    }
  }, 1500 )
}