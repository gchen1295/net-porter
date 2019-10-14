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

async function getProducts(){
try
{
  let p = await request({
    url: `https://undefeated.com/products.json?limit=56242461&page=1`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
      'Cache-Control': 'no-cache, no-store, private, must-revalidate, max-age=0, max-stale=0, post-check=0, pre-check=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Vary': '*',
      'cf-cache-status': 'bypass'
    },
    resolveWithFullResponse: true,
    followAllRedirects: true
  })
  if(p.headers['x-cache'] === 'miss')
  {
    console.log(JSON.parse(p.body))
  }
  
}
catch(err)
{
  console.log(err)
}
}

getProducts()

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