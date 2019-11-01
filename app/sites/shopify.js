require('dotenv').config()
var jar = require('request-promise').jar()
var tough = require('tough-cookie');
const request = require('request-promise').defaults({
  jar: jar
});
let Promise = require("bluebird");
const mongoose = require('mongoose')
const cheerio = require('cheerio')
const Products = require('../models/product')
const Config = require('../models/config')
let _ = require('lodash');
let que = require('../queue.js')
let date = new Date()

let limit = 249


const CLOTHINGWH = 'https://discordapp.com/api/webhooks/638929103482781696/Ts_t_2lThFyjOYeDG0qaWkxF99PUa7LCIIRNAT41CudBfNg5MWHXIs1PYiUiPo-IPCeD'
const SNEAKERWH = 'https://discordapp.com/api/webhooks/639855061001830456/VCVMsBcIJTKwTqzchV_8HFPEOUK7I_tPVv60nDOnzaWvQDZ9sFb-tkLpOWe7i2Hhvl8j'
sendForm(SNEAKERWH)
async function sendForm(wh)
{
  try
  {
    await request.post(wh ,{
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: "PremeProfits Autocheckout",
        avatar_url: "https://cdn.discordapp.com/avatars/638929103482781696/0f8d97a7eafcbe6479930a9fe75a751e.png",
        embeds: [
          {
            title: `FEAR OF GOD "OATMEAL"`,
            url: 'https://forms.gle/Tt3LscbSrJTBVnK76',
            description: 'FEAR OF GOD "OATMEAL"\n$40 PAS',
            color: 0xFF0000,
            footer: {
              icon_url:
                "https://cdn.discordapp.com/avatars/638929103482781696/0f8d97a7eafcbe6479930a9fe75a751e.png",
              text: "Powered by PremeProfits"
            },
            image: {
              url: 'https://sneakernews.com/wp-content/uploads/2019/10/nike-air-fear-of-god-1-AR4237-900-1.jpg'
            }
          }
        ]
      })
    });
  }
  catch(err)
  {

  }
}

async function getProducts(domain){
try
{
  let yest = date.setDate(date.getDate() - 1)
  let p = await request({
    url: `https://${domain}/collections/all/products.json?limit=${limit}&page=1`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
      'Cache-Control': 'no-cache, no-store, private, must-revalidate, max-age=0, max-stale=0, post-check=0, pre-check=0',
      'Pragma': 'no-cache',
      'Expires': `${new Date(yest).toGMTString()}`,
      //'Vary': '*',
      //'cf-cache-status': 'bypass',
      //'Accept-Encoding': 'identity'
    },
    resolveWithFullResponse: true,
    followAllRedirects: true
  })
  
  if(limit = 50)
  {
    limit = 250
  }
  else
  {
    limit--
  }
  return JSON.parse(p.body).products
}
catch(err)
{
  console.log(err)
  if(err.statusCode === 401)
  {
    return 'Password Page'
  }
}
}
// getProducts('undefeated.com').then(async p => {
//   let cleanedProducts = await cleanProducts(p)
//   let e = buildNewProduct('undefeated.com', cleanedProducts[0])
//   await request.post('https://discordapp.com/api/webhooks/575801478623657984/6tJ2XHBttrcahTofDRTaRDyaRLK5jUjb8vWeg-Lg6JVL9NKSjecPclQ_nBbuphmFSJlL',{
//     headers: {
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify(e)
//   })
// })
async function cleanProducts(products)
{
  try
  {
    let cleanedProducts = []
    for(let i in products)
    {
      let productID = products[i].id
      let productTitle = products[i].title
      let productHandle = products[i].handle
      let productPrice = products[i].variants[0].price
      let productImage = products[i].images[0].src
      let productVariants = []

      for(let j in products[i].variants)
      {
        let variant = {
          id: products[i].variants[j].id,
          title: products[i].variants[j].title,
          available: products[i].variants[j].available
        }
        productVariants.push(variant)
      }
      cleanedProducts.push({
        productID,
        productTitle,
        productHandle,
        productPrice,
        productImage,
        productVariants
      })
    }
    return cleanedProducts
  }
  catch(err)
  {
    console.log(err)
  }
}

function buildNewProduct(domain, product)
{
  try
  {
    let emb = {
      username: `${domain}`,
      avatar_url: "https://dwglogo.com/wp-content/uploads/2017/11/Shopify_logo_01.png",
      embeds: [
        {
          title: product.productTitle,
          url: `https://${domain}/products/${product.productHandle}`,
          color: 0xFFFF33,
          thumbnail: {
            url: product.productImage
          },
          fields: [{
            name: 'Price',
            value: `$${product.productPrice}`
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
    for(let i = 0; i < product.productVariants.length; i++)
    {
      if(i%2 === 0)
      {
        let field = `[${product.productVariants[i].title}](https://${domain}/cart/${product.productVariants[i].id}:1)`
        sizeFields.push(field)
      }
      else
      {
        let field2 = `[${product.productVariants[i].title}](https://${domain}/cart/${product.productVariants[i].id}:1)`
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

function startmonitor() {
  setTimeout(async function () {
    try{
      // Grab all products
      // Check for new products
        // If new products found push
        // Else check for kws and if matches check for restocks
        
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