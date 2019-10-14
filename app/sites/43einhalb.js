require('dotenv').config()
const request = require('request-promise')
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
    url: 'https://www.solebox.com/index.php?cl=alist',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'
    },
    resolveWithFullResponse: true,
    followAllRedirects: true
  })
  console.log(p.body)
}
catch(err)
{
  console.log(err.statusCode)
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

/*s: a66818db899dbc23815a138a49bfcc4089ad153f-1571093417-0-AUPGEMcmXgEcNj9jHj6/OPeePuvaZo9aIZJ2RGmvYzG2M7Af5sYQqI3ZW7veKFA3P70ER/+bEc7jvZZz2g6YW0nHq8cUpizaGhy5v+bGT2FZOcNtMt+WU05lvsiN1qva5oQJI+WgMOvrwnlDDiqxN2q3SuIEOP+7Ag6p4AtZFcV/OPTf1EWPvtmLSVEqyPCQ1JaVZNsRqYfDsRPtQTWLQ7c=
id: 525d1c809b32c5cc
g-recaptcha-response: 03AOLTBLR2AXSzA0jJHO-rX4xGiGFo29DFgvysbwM5MbCcY_ZFf7HNtnTffzbSQVrCzPcyZu89ykhNHQJYJetP11jSQjV4oPN1P3zZJwvtWltEnGiIAUsGTfSj3W-Y0cp4lw5NUqon6z-iKS6Tuvw2zspaPDcivstwYBNUMtUT2JZ9SW59QzJZHf6yGyi1Lk--djgr3khrFNxY8DyInHcM17QQQ0xieDtvDv7EhWiMT1_ur1wxPUaYTxEobsZstSLplHX7gsiPdx9oxq6NO-VANJZpgRL0tCP1XQJRaeMsc2I5-2C0STu84UqZE6oUcftXoSSF1XwSU4nBCW9GD6B4ko_i8N5f8xhAyv1hcQvGvQ3gw3iPciZjS8fcdbf_qGyG86LlDCzBfh8u3wHNRPTBaA7V8YKJIr-tLbLPMbY61ccgSFRAGG7vfSLH5J8xVl-SKYlMp_FyK70f10gpDkxOC_s_FHpVXthbSP4Lkuf_4DdLpTmsken0u-OtS_F_ckNBXdS4SU89HJiD 


https://www.43einhalb.com/cdn-cgi/l/chk_captcha?s=a66818db899dbc23815a138a49bfcc4089ad153f-1571093417-0-AUPGEMcmXgEcNj9jHj6%2FOPeePuvaZo9aIZJ2RGmvYzG2M7Af5sYQqI3ZW7veKFA3P70ER%2F%2BbEc7jvZZz2g6YW0nHq8cUpizaGhy5v%2BbGT2FZOcNtMt%2BWU05lvsiN1qva5oQJI%2BWgMOvrwnlDDiqxN2q3SuIEOP%2B7Ag6p4AtZFcV%2FOPTf1EWPvtmLSVEqyPCQ1JaVZNsRqYfDsRPtQTWLQ7c%3D&id=525d1c809b32c5cc&g-recaptcha-response=03AOLTBLR2AXSzA0jJHO-rX4xGiGFo29DFgvysbwM5MbCcY_ZFf7HNtnTffzbSQVrCzPcyZu89ykhNHQJYJetP11jSQjV4oPN1P3zZJwvtWltEnGiIAUsGTfSj3W-Y0cp4lw5NUqon6z-iKS6Tuvw2zspaPDcivstwYBNUMtUT2JZ9SW59QzJZHf6yGyi1Lk--djgr3khrFNxY8DyInHcM17QQQ0xieDtvDv7EhWiMT1_ur1wxPUaYTxEobsZstSLplHX7gsiPdx9oxq6NO-VANJZpgRL0tCP1XQJRaeMsc2I5-2C0STu84UqZE6oUcftXoSSF1XwSU4nBCW9GD6B4ko_i8N5f8xhAyv1hcQvGvQ3gw3iPciZjS8fcdbf_qGyG86LlDCzBfh8u3wHNRPTBaA7V8YKJIr-tLbLPMbY61ccgSFRAGG7vfSLH5J8xVl-SKYlMp_FyK70f10gpDkxOC_s_FHpVXthbSP4Lkuf_4DdLpTmsken0u-OtS_F_ckNBXdS4SU89HJiD
*/