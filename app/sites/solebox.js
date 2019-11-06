require('dotenv').config({path: __dirname + '/../.env'})
const request = require('request-promise')
let Promise = require("bluebird");
const mongoose = require('mongoose')
const cheerio = require('cheerio')
const Products = require('../models/soleProduct')
const Config = require('../models/config')
const housecall = require("housecall");
const puppeteer = require("puppeteer-extra");
// add stealth plugin and use defaults (all evasion techniques)
const pluginStealth = require("puppeteer-extra-plugin-stealth")
puppeteer.use(pluginStealth())
let _ = require('lodash');
let que = require('../queue.js')
let date = new Date()
let queue = housecall({
  concurrency: 1,
  cooldown: 1100
});

var errorHook = process.env.ERRORHOOK
const mongoserver = process.env.MONGO_SERVER
const db = process.env.MONGO_DB
mongoose.connect(`mongodb://${mongoserver}/${db}`, {
  useNewUrlParser: true,
  useCreateIndex: true
}, async (err,cl)=>{
  if(err)
  {
    console.log(err)
    return
  } 
  let config = await Config.findOne()
  if(config)
  {
    kwSets = config.keywords
    proxies = config.proxies
    filtered = config.filtered
    unfiltered = config.unfiltered
    //px3Cookie = config.px3Cookie
    startmonitor()
  }
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
        //px3Cookie = config.px3Cookie
      }
    }
  })
})
mongoose.Promise = global.Promise;

let kwSets = []
let proxies = []
let filtered = []
let unfiltered = []
let px3Cookie

async function getProducts(proxy){
try
{
  let proxyParts = proxy.split(':')
  let agent
  let pxCookie = px3Cookie[0]
  if(pxCookie === undefined) return
  if(proxyParts[2] && proxyParts[3])
  {
    agent = "http://" + proxyParts[2] + ':' + proxyParts[3] + '@' + proxyParts[0] + ':' + proxyParts[1]
  }
  else
  {
    agent = "http://" + proxyParts[0] + ':' + proxyParts[1]
  }
  let p = await request({
    url: 'https://www.solebox.com/index.php?cl=alist',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
      'cookie': `_pxvid=${pxCookie}`
    },
    resolveWithFullResponse: true,
    followAllRedirects: true,
    proxy: agent
  })
  let $ = cheerio.load(p.body)
  let products = []
  $('li.productData').each((i,e)=>{
    let productLink = $(e).find('a').attr('href')
    let productTitle = $(e).find('a').attr('title').trim()
    let productImage = $(e).find('img').attr('src')
    let productPrice = $(e).find('div.priceContainer ').text().trim()
    products.push({productLink, productTitle, productImage, productPrice})
  })
  return products
}
catch(err)
{
  px3Cookie = await soleboxGenerator(proxy)
  await getProducts(proxy)
  if(err.statusCode)
  {
    let e = buildError(`GetProducts Solebox: ${err.statusCode}\n${productURL}`)
    sendErrorWebhook(e)
  }
  else
  {
    let e = buildError(`GetProducts Solebox: ${err}\n${productURL}`)
    sendErrorWebhook(e)
  }
}
}

async function getProductSizes(productLink, proxy){
  try
  {
    let proxyParts = proxy.split(':')
    let agent 
    let pxCookie = px3Cookie[0]
    if(pxCookie === undefined) return
    if(proxyParts[2] && proxyParts[3])
    {
      agent = "http://" + proxyParts[2] + ':' + proxyParts[3] + '@' + proxyParts[0] + ':' + proxyParts[1]
    }
    else
    {
      agent = "http://" + proxyParts[0] + ':' + proxyParts[1]
    }
    let p = await request({
      url: productLink,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
        'cookie': `_pxvid=${pxCookie}`
      },
      resolveWithFullResponse: true,
      followAllRedirects: true,
      proxy: agent
    })
    let $ = cheerio.load(p.body)
    let sizes = []
    $('div.size').each((i,e)=>{
      let sizeName = $(e).find('a').attr('data-size-original')
      let pid = $(e).find('a').attr('id')
      //let atcLink = `https://www.solebox.com/index.php?aproducts%5B0%5D%5Bam%5D=1&fnc=changebasket&cl=basket&aproducts%5B0%5D%5Baid%5D=${pid}`
      sizes.push({sizeName, pid})
    })
    return sizes
  }
  catch(err)
  {
    px3Cookie = await soleboxGenerator(proxy)
    await getProductSizes(productLink, proxy)
    if(err.statusCode)
    {
      let e = buildError(`GetSize Solebox: ${err.statusCode}\n${productURL}`)
      sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`GetSize Solebox: ${err}\n${productURL}`)
      sendErrorWebhook(e)
    }
    if(px3Cookie.length > 0)
    {
      getProductSizes(productLink, proxy)
    }
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
            body: JSON.stringify(embedData)
          });
        }
        catch(err)
        {
          console.log(err)
          sendErrorWebhook(embedData)
        }
      });
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

function buildNewProduct(product)
{
  try
  {
    let emb = {
      username: "Solebox",
      avatar_url: "https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128",
      embeds: [
        {
          title: `${product.productTitle}`,
          url: product.productLink,
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
    for(let i = 0; i < product.productSizes.length; i++)
    {
      if(i%2 === 0)
      {
        let field = `[${product.productSizes[i].sizeName}](https://www.solebox.com/index.php?aproducts%5B0%5D%5Bam%5D=1&fnc=changebasket&cl=basket&aproducts%5B0%5D%5Baid%5D=${product.productSizes[i].pid})`
        sizeFields.push(field)
      }
      else
      {
        let field2 = `[${product.productSizes[i].sizeName}](https://www.solebox.com/index.php?aproducts%5B0%5D%5Bam%5D=1&fnc=changebasket&cl=basket&aproducts%5B0%5D%5Baid%5D=${product.productSizes[i].pid})`
        sizeFields2.push(field2)
      }
    }
    emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields.join('\n'), inline: true})
    emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields2.join('\n'), inline: true})
    return emb
  }
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`BuildNew Solebox: ${err.statusCode}\n${productURL}`)
      sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`BuildNew Solebox: ${err}\n${productURL}`)
      sendErrorWebhook(e)
    }
  }
}

function buildRestocked(product)
{
  try
  {
    let emb = {
      username: "Solebox",
      avatar_url: "https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128",
      embeds: [
        {
          title: `${product.productTitle} Restocked!`,
          url: product.productLink,
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
    for(let i = 0; i < product.productSizes.length; i++)
    {
      if(i%2 === 0)
      {
        let field = `[${product.productSizes[i].sizeName}](https://www.solebox.com/index.php?aproducts%5B0%5D%5Bam%5D=1&fnc=changebasket&cl=basket&aproducts%5B0%5D%5Baid%5D=${product.productSizes[i].pid})`
        sizeFields.push(field)
      }
      else
      {
        let field2 = `[${product.productSizes[i].sizeName}](https://www.solebox.com/index.php?aproducts%5B0%5D%5Bam%5D=1&fnc=changebasket&cl=basket&aproducts%5B0%5D%5Baid%5D=${product.productSizes[i].pid})`
        sizeFields2.push(field2)
      }
    }
    emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields.join('\n'), inline: true})
    emb.embeds[0].fields.push({name: 'Sizes', value: sizeFields2.join('\n'), inline: true})
    return emb
  }
  catch(err)
  {
    console.log(err)
    if(err.statusCode)
    {
      let e = buildError(`BuildRestock Solebox: ${err.statusCode}\n${productURL}`)
      sendErrorWebhook(e)
    }
    else
    {
      let e = buildError(`BuildRestock Solebox: ${err}\n${productURL}`)
      sendErrorWebhook(e)
    }
  }
}

function startmonitor(initialProxy) {
  setTimeout(async function () {
    try{
      // if(px3Cookie.length === 0)
      // {
      //   console.log("No PX3 Cookie!")
      //   startmonitor()
      //   return
      // }
      
      if(proxies.length === 0)
      {
        console.log("Waiting on proxies")
        startmonitor()
        return
      }
      let currPlist = proxies
      let proxy = currPlist.shift()
      currPlist.push(proxy)
      console.log(proxy)
      // Find new products
      px3Cookie = await soleboxGenerator(proxy)
      console.log(px3Cookie)
      let bareProducts = await getProducts(proxy)
      // If new product find sizes and push notification
        // Go through database and check if its in database
        // If not we save
        // If it is we check if its a filtered product
          // If it is a filtered we check for restocks
      let jobs = []
      if(bareProducts)
      {
      for(let i in bareProducts)
      {
        proxy = currPlist.shift()
        currPlist.push(proxy)
        let found = await Products.findOne({productTitle: bareProducts[i].productTitle})
        if(found)
        {
          //console.log(found)
          // Check kws to see if we want to check for restocks
          let isMatch = false
          if(kwSets.length > 0)
          {
            for(let j = 0; j < kwSets.length; j++)
            {
              let kws = kwSets[j].split(',')
              let pkw = []
              let nkw = []
              
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

              let matchesAll = true;
              for(let l in pkw)
              {
                let kw = pkw[l].toLowerCase();
                if(!bareProducts[i].productTitle.toLowerCase().includes(kw))
                {
                  matchesAll = false;
                }
              }
              if(matchesAll)
              {
                isMatch = true
              }
              

              for(let b in nkw)
              {
                let kw = nkw[b].toLowerCase();
                if(bareProducts[i].productTitle.toLowerCase().includes(kw))
                {
                  isMatch = false
                }
              } 
            }
          }
          if(isMatch)
          {
            let sizes = await getProductSizes(bareProducts[i].productLink ,proxy)
            bareProducts[i].productSizes = sizes
            // Compare current sizes with found sizes
            let oldSizes = []
            let restocked = false
            for(let a in found.productSizes)
            {
              oldSizes.push(found.productSizes[a].size)
            }
            for(let b in sizes)
            {
              if(!oldSizes.includes(sizes[b].size))
              {
                restocked = true
              }
            }
            if(restocked)
            {
              // Send a notification
              let emb = buildRestocked(bareProducts[i])
              for(let j = 0; j < unfiltered.length; ++j)
              {
                if(unfiltered[j].sbWebhook)
                {
                  let e = _.cloneDeep(emb)
                  e.avatar_url = unfiltered[j].logo
                  e.embeds[0].footer.icon_url = unfiltered[j].logo
                  e.embeds[0].color = parseInt(unfiltered[j].color)
                  e.embeds[0].footer.text = unfiltered[j].footer
                  // jobs.push(request.post(unfiltered[j].sbWebhook,{
                  //   headers: {
                  //     'Content-Type': 'application/json'
                  //   },
                  //   body: JSON.stringify(e)
                  // }))
                  request.post(unfiltered[j].sbWebhook,{
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(e)
                  })
                }
              }
            }
            found.productSizes = sizes
            await found.save()
            //await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        else
        {
          
          // Get sizes and save
          let sizes = await getProductSizes(bareProducts[i].productLink, proxy)
          bareProducts[i].productSizes = sizes
          if(bareProducts[i].productSizes.length > 0)
          {
            // Send a notification
            let emb = buildNewProduct(bareProducts[i])
            for(let j = 0; j < unfiltered.length; ++j)
            {
              if(unfiltered[j].sbWebhook)
              {
                let e = _.cloneDeep(emb)
                e.avatar_url = unfiltered[j].logo
                e.embeds[0].footer.icon_url = unfiltered[j].logo
                e.embeds[0].color = parseInt(unfiltered[j].color)
                e.embeds[0].footer.text = unfiltered[j].footer
                // jobs.push(request.post(unfiltered[j].sbWebhook,{
                //   headers: {
                //     'Content-Type': 'application/json'
                //   },
                //   body: JSON.stringify(e)
                // }))
                
                request.post(unfiltered[j].sbWebhook,{
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(e)
                })
              }
            }
          }
          let newProduct = new Products({productTitle: bareProducts[i].productTitle, productSizes: bareProducts[i].productSizes})
          await newProduct.save()
          //await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
      //await que.enqueue(jobs, 1000)
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
        await sendErrorWebhook(e)
      }
      startmonitor()
    }
  }, 1500 )
}

async function soleboxGenerator(proxy)
{
  try{
    let validCookie = false
    let p = proxy.split(":");
    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      //executablePath: chromePaths.chrome,
      args: [
        `--proxy-server=${p[0]}:${p[1]}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--lang=en-US,en;q=0.9',
        `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.70 Safari/537.36`,
      ],
      headless: true
    });
    let pages = await browser.pages()
    let page = pages[0]
    let username = p[2];
    let password = p[3];
    await page.authenticate({ username, password });
    let r1 = await page.goto('https://www.solebox.com/en/New/')
    await page.mouse.move(256, 500)
    await new Promise(resolve =>
      setTimeout(resolve, 250)
    );
    await page.mouse.move(10, 152)
    await page.mouse.down()
    await page.mouse.up()
    await page.mouse.down()
    await page.mouse.up()
    await page.mouse.move(136, 523)
    cookies = await page.cookies('https://www.solebox.com/')
    let c
    for(let i in cookies)
    {
      //console.log(cookies[i].name)
      if(cookies[i].name === '_pxvid')
      {
        c = {
          name: cookies[i].name,
          value: cookies[i].value
        }
        // console.log(c)
        // let conf = await Config.findOne({})
        // if(conf)
        // {
        //   if(conf.px3Cookie)
        //   {
        //     conf.px3Cookie.push(cookies[i].value)
        //   }
        //   else
        //   {
        //     conf.px3Cookie= [cookies[i].value]
        //   }
        //   await conf.save()
        // }
      }
    }
    await page.close()
    await browser.close()
    return c.value
  }catch(err)
  {
    console.log(err)
    console.log(jar)
  }
}