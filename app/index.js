require('dotenv').config()
const discord = require('discord.js')
let bot = new discord.Client()
const mongoose = require('mongoose')
let Servers = require('./models/servers.js')
let Config = require('./models/config.js')
const child_process = require('child_process')
const housecall = require("housecall");
let queue = housecall({
  concurrency: 1,
  cooldown: 700
});

// GLOBALS
let owner
let prefix = 'nap!'
// let monitorStarted = false
// let monitor

bot.login(process.env.BOT_TOKEN).then(async ()=>{
  const mongoserver = process.env.MONGO_SERVER
  const db = process.env.MONGO_DB
  mongoose.connect(`mongodb://${mongoserver}/${db}`, {
    useNewUrlParser: true,
    useCreateIndex: true
  })
  let appl = await bot.fetchApplication()
  owner = appl.owner
  mongoose.Promise = global.Promise;
})

// Server setup functions
bot.on('message', async message => {
  if (message.author.bot) return
  // Check and load server info
  let args = message.content.split(' ')
  let msgprefix = args[0].substring(0, prefix.length)
  if(msgprefix !== prefix) return 
  let cmd = args[0].substring(prefix.length, args[0].length)
  let serverInfo
  if(message.channel.type !== 'dm')
  {
    serverInfo = await Servers.findOne({serverID: message.guild.id})
  }
   
  if(message.author.id === owner.id)
  {
    if(cmd === 'auth')
    {
      //let serverInfo = await Servers.findOne({id: message.guild.id})
      if(args[1] === undefined) return
      let server = await Servers.findOne({serverID: args[1]})
      if(server)
      {
        await message.channel.send({embed: {
          title: "Server Authorized!",
          description: `Server already authorized`
        }})
      }
      else
      {
        let newServer = new Servers({serverID: args[1], authorizedUsers: [owner.id]})
        await newServer.save()
        message.channel.send({embed: {
          title: "Server Authorized",
          description: `Authorized ${args[1]}`
        }})
      }
      return
    }
    if(cmd === 'unauth')
    {
      if(args[1] === undefined) return
      let server = await Servers.findOne({serverID: args[1]})
      if(server)
      {
        let config = await Config.findOne()
        for(let i = 0; i < config.unfiltered.length; i++)
        {
          if(config.unfiltered[i].webhook === serverInfo.unfilterChannelWH)
          {
            config.unfiltered.splice(i, 1)
            break
          }
        }
        for(let j = 0; j < config.filtered.length; j++)
        {
          if(config.filtered[j].webhook === serverInfo.filteredChannelWH)
          {
            config.filtered.splice(j ,1)
            break
          }
        }
        await config.save()
        await server.remove()
        await message.channel.send({embed: {
          title: "Server Removed!",
          description: `Server has been removed`
        }})
      }
      else
      {
        message.channel.send({embed: {
          title: "Server Not Found",
          description: `Cannot find mentioned server!`
        }})
      }
      return
    }
    if(cmd === 'setlogo' && message.channel.type !== 'dm')
    {
      //let serverInfo = await Servers.findOne({id: message.guild.id})
      if(serverInfo)
      {
        let config = await Config.findOne()
        
        serverInfo.logo = args[1]
        for(let i = 0; i < config.unfiltered.length; i++)
        {
          if(config.unfiltered[i].serverID === serverInfo.serverID)
          {
            config.unfiltered[i].logo = args[1]
            break
          }
        }
        for(let j = 0; j < config.filtered.length; j++)
        {
          if(config.filtered[j].serverID === serverInfo.serverID)
          {
            config.filtered[j].logo = args[1]
            break
          }
        }
        await config.save()
        await serverInfo.save()
        message.channel.send({embed: {
          author: {
            name: 'Logo Set!',
            icon_url: serverInfo.logo,
          },
        }})
      }
      else
      {
        await message.channel.send({embed: {
          title: "Server Not Authorized!",
          description: `Please authorize ${message.guild.id}`
        }})
      }
      return
    }
    if(cmd === 'setcolor' && message.channel.type !== 'dm')
    {
      //let serverInfo = await Servers.findOne({id: message.guild.id})
      if(serverInfo)
      {
        serverInfo.color = '0x' + args[1].substring(1,args[1].length)
        let config = await Config.findOne()

        for(let i = 0; i < config.unfiltered.length; i++)
        {
          if(config.unfiltered[i].serverID === serverInfo.serverID)
          {
            console.log(config.unfiltered[i].webhook)
            config.unfiltered[i].color = serverInfo.color
            break
          }
        }
        for(let j = 0; j < config.filtered.length; j++)
        {
          if(config.filtered[j].serverID === serverInfo.serverID)
          {
            config.filtered[j].color = serverInfo.color
            break
          }
        }
        await config.save()
        console.log(config)
        await message.channel.send({embed: {
          title: "Embed color set!",
          color: parseInt(serverInfo.color),
          description: `If embed is invalid please input a valid hex color in format #FFFFFF`
        }})
        await serverInfo.save()
      }
      else
      {
        await message.channel.send({embed: {
          title: "Server Not Authorized!",
          description: `Please authorize ${message.guild.id}`
        }})
      }
      return
    }
    if(cmd === 'setfooter' && message.channel.type !== 'dm')
    {
      //let serverInfo = await Servers.findOne({id: message.guild.id})
      if(serverInfo)
      {
        if(args[1] === undefined) return
        let config = await Config.findOne()

        for(let i = 0; i < config.unfiltered.length; i++)
        {
          if(config.unfiltered[i].serverID === serverInfo.serverID)
          {
            config.unfiltered[i].footer = args[1]
            break
          }
        }
        for(let j = 0; j < config.filtered.length; j++)
        {
          if(config.filtered[j].serverID === serverInfo.serverID)
          {
            config.filtered[j].footer = args[1]
            break
          }
        }
        await config.save()
        await message.channel.send({embed: {
          title: "Footer text set!",
          color: parseInt(serverInfo.color),
          footer: {
            text: args[1]
          }
        }})
        await serverInfo.save()
      }
      else
      {
        await message.channel.send({embed: {
          title: "Server Not Authorized!",
          description: `Please authorize ${message.guild.id}`
        }})
      }
      return
    }
    if(cmd === 'setup' && message.channel.type !== 'dm')
    {
      //let serverInfo = await Servers.findOne({id: message.guild.id})
      if(serverInfo)
      {
        //if(serverInfo.setupDone) return
        // Set name of footer and guild
        serverInfo.serverName = message.guild.name

        let config = await Config.findOne()

        let filterch
        let unfilterch
        let filterUS
        let unfilterUS

        let uwh
        let fwh
        let usfwh
        let usuwh

        let filteredGBWebhook
        let unfilterGBWebhook
        let filteredUSWebhook
        let unfilteredUSWebhook

        
        if(message.guild.channels.some(channel => channel.name === 'nap-gb-unfiltered'))
        {
          unfilterch = message.guild.channels.find(channel => channel.name === 'nap-gb-unfiltered')
          uwh = await unfilterch.fetchWebhooks()
          if(uwh.first() === undefined)
          {
            uwh = await unfilterch.createWebhook('NAP GB Unfiltered')
            unfilterGBWebhook = `https://discordapp.com/api/webhooks/${uwh.id}/${uwh.token}`
          }
          else
          {
            unfilterGBWebhook = `https://discordapp.com/api/webhooks/${uwh.first().id}/${uwh.first().token}`
          }
          await message.channel.send(`Setup <#${unfilterch.id}>`)
        }
        else
        {
          unfilterch = await message.guild.createChannel('nap-gb-unfiltered',{type: 'text'})
          uwh = await unfilterch.createWebhook('NAP GB Unfiltered')
          unfilterGBWebhook = `https://discordapp.com/api/webhooks/${uwh.id}/${uwh.token}`
          await message.channel.send(`Created <#${unfilterch.id}>`)
        }
        // Create filtered channel
        if(message.guild.channels.some(channel => channel.name === 'nap-gb-filtered'))
        {
          filterch = message.guild.channels.find(channel => channel.name === 'nap-gb-filtered')
          fwh = await filterch.fetchWebhooks()
          if(fwh.first() === undefined)
          {
            fwh = await filterch.createWebhook('NAP GB Filtered')
            filteredGBWebhook = `https://discordapp.com/api/webhooks/${fwh.id}/${fwh.token}`
          }
          else
          {
            filteredGBWebhook = `https://discordapp.com/api/webhooks/${fwh.first().id}/${fwh.first().token}`
          }
          await message.channel.send(`Setup <#${filterch.id}>`)
        }
        else
        {
          filterch = await message.guild.createChannel('nap-gb-filtered',{type: 'text'})
          fwh = await filterch.createWebhook('NAP Filtered')
          filteredGBWebhook = `https://discordapp.com/api/webhooks/${fwh.id}/${fwh.token}`
          await message.channel.send(`Created <#${filterch.id}>`)
        }
        if(message.guild.channels.some(channel => channel.name === 'nap-us-filtered'))
        {
          filterUS = message.guild.channels.find(channel => channel.name === 'nap-us-filtered')
          usfwh = await filterUS.fetchWebhooks()
          if(usfwh.first() === undefined)
          {
            usfwh = await filterUS.createWebhook('NAP US Filtered')
            filteredUSWebhook = `https://discordapp.com/api/webhooks/${usfwh.id}/${usfwh.token}`
          }
          else
          {
            filteredUSWebhook = `https://discordapp.com/api/webhooks/${usfwh.first().id}/${usfwh.first().token}`
          }
          await message.channel.send(`Setup <#${filterUS.id}>`)
        }
        else
        {
          filterUS = await message.guild.createChannel('nap-us-filtered',{type: 'text'})
          usfwh = await filterUS.createWebhook('NAP Filtered')
          filteredUSWebhook = `https://discordapp.com/api/webhooks/${usfwh.id}/${usfwh.token}`
          await message.channel.send(`Created <#${filterUS.id}>`)
        }

        if(message.guild.channels.some(channel => channel.name === 'nap-us-unfiltered'))
        {
          unfilterUS = message.guild.channels.find(channel => channel.name === 'nap-us-unfiltered')
          usuwh = await unfilterUS.fetchWebhooks()
          if(usuwh.first() === undefined)
          {
            usuwh = await unfilterUS.createWebhook('NAP US Unfiltered')
            unfilteredUSWebhook = `https://discordapp.com/api/webhooks/${usuwh.id}/${usuwh.token}`
          }
          else
          {
            unfilteredUSWebhook = `https://discordapp.com/api/webhooks/${usuwh.first().id}/${usuwh.first().token}`
          }
          await message.channel.send(`Setup <#${unfilterUS.id}>`)
        }
        else
        {
          unfilterUS = await message.guild.createChannel('nap-us-unfiltered',{type: 'text'})
          usuwh = await unfilterUS.createWebhook('NAP Filtered')
          unfilteredUSWebhook = `https://discordapp.com/api/webhooks/${usuwh.id}/${usuwh.token}`
          await message.channel.send(`Created <#${unfilterUS.id}>`)
        }
        
 
        
        if(config)
        {
          let configIndex
          for(let i = 0; i < config.filtered.length; ++i)
          {
            if(config.filtered[i].serverID === message.guild.id)
            {
              configIndex = i
            }
          }
          if(configIndex)
          {
            config.filtered[configIndex].webhook = filteredGBWebhook
            config.filtered[configIndex].napWebhookUS = filteredUSWebhook

            config.unfiltered[configIndex].webhook = unfilterGBWebhook
            config.unfiltered[configIndex].napWebhookUS = unfilteredUSWebhook
          }
          else
          {
            config.filtered.push({
              serverID: serverInfo.serverID,
              color: 16753920, 
              logo: 'https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128',
              footer: '~Woof~#1001', 
              webhook: filteredGBWebhook,
              napWebhookUS: filteredUSWebhook
            })
            config.unfiltered.push({
              serverID: serverInfo.serverID,
              color: 16753920, 
              logo: 'https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128',
              footer: '~Woof~#1001', 
              webhook: unfilterGBWebhook,
              napWebhookUS: unfilteredUSWebhook
            })
          }
          await config.save()
        }
        else
        {
          let newConfig = new Config({
            proxies: [],
            keywords: [],
            filtered: [{
              serverID: serverInfo.serverID,
              color: 16753920, 
              logo: 'https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128',
              footer: '~Woof~#1001',
              webhook: filteredGBWebhook,
              napWebhookUS: filteredUSWebhook
            }],
            unfiltered: [{
              serverID: serverInfo.serverID,
              color: 16753920, 
              logo: 'https://cdn.discordapp.com/icons/613371089158012938/1fd21f22b481124632a7149a4434a851.png?size=128',
              footer: '~Woof~#1001',
              webhook: unfilterGBWebhook,
              napWebhookUS: unfilteredUSWebhook
            }]
          })
          await newConfig.save()
        }
        await serverInfo.save()
      }
      else
      {
        await message.channel.send({embed: {
          title: "Server Not Authorized!",
          description: `Please authorize ${message.guild.id}`
        }})
      }
      return
    }
    if(cmd === 'authuser' && message.channel.type !== 'dm')
    {
      //let serverInfo = await Servers.findOne({id: message.guild.id})
      if(serverInfo)
      {
        let user = await message.guild.members.get(args[1])
        if(user)
        {
          serverInfo.authorizedUsers.push(args[1])
          await serverInfo.save()
          await message.channel.send({embed: {
            title: "User Authorized!",
            description: `${user.tag} authorized!`
          }})
        }
        else
        {
          await message.channel.send({embed: {
            title: "User Not Found!",
            description: `Could not find user ${args[1]}`
          }})
        } 
      }
      else
      {
        await message.channel.send({embed: {
          title: "Server Not Authorized!",
          description: `Please authorize ${message.guild.id}`
        }})
      }
      return
    }
    if(cmd === 'unauthuser' && message.channel.type !== 'dm')
    {
      //let serverInfo = await Servers.findOne({id: message.guild.id})
      if(serverInfo)
      {
        let i = serverInfo.authorizedUsers.findIndex(args[1])
        if(i > -1)
        {
          let user = await message.guild.members.get(args[1])
          serverInfo.authorizedUsers.splice(i, 1)
          await serverInfo.save()
          await message.channel.send({embed: {
            title: "User Removed!",
            description: `${user.tag} removed!`
          }})
        }
        else
        {
          await message.channel.send({embed: {
            title: "User Not Found!",
            description: `Could not find user ${args[1]}`
          }})
        } 
      }
      else
      {
        await message.channel.send({embed: {
          title: "Server Not Authorized!",
          description: `Please authorize ${message.guild.id}`
        }})
      }
      return
    }
    if(cmd === 'addproxy')
    {
      let config = await Config.findOne()
      if(config)
      {
        try
        {
          let msg = await message.channel.send("Enter proxies to add:")
          let proxies = await msg.channel.awaitMessages(m => m.author.id === message.author.id, { maxMatches: 1, time: 60000, errors: ['time'] })
          proxies = proxies.first().content.trim().split('\n')
          let pmsg = proxies.join('\n')
          message.channel.send(`\`\`\`${pmsg}\`\`\``)
          for(let i in proxies)
          {
            config.proxies.push(proxies[i])
          }
          console.log(config.proxies)
          await config.save()
          message.channel.send('Proxies Added!')
        }
        catch(err)
        {
          console.log(err)
          message.author.send({embed: {
            title: "Timed out!",
            color: 0xff0000,
            description: "Timed out!"
          }})
          return
        }
      }
      else
      {
        try
        {
          let msg = await message.channel.send("Enter proxies to add:")
          let proxies = await msg.channel.awaitMessages(m => m.author.id === message.author.id, { maxMatches: 1, time: 60000, errors: ['time'] })
          proxies = proxies.first().content.trim().split('\n')
          let pmsg = proxies.join('\n')
          message.channel.send(`\`\`\`${pmsg}\`\`\``)
          
          let newConfig = new Config({
            proxies: [],
            keywords: [],
            filtered: [],
            unfiltered: []
          })
          
          for(let i in proxies)
          {
            newConfig.proxies.push(proxies[i])
          }
          await newConfig.save()
          message.channel.send({embed: {
            title: "New config created!"
          }})
          message.channel.send('Proxies Added!')
        }
        catch(err)
        {
          console.log(err)
          message.author.send({embed: {
            title: "Timed out!",
            color: 0xff0000,
            description: "Timed out!"
          }})
          return
        }
        
      }
      return
    }
    if(cmd === 'clearproxy')
    {
      let config = await Config.findOne()
      if(config)
      {
        config.proxies = []
        await config.save()
        message.channel.send('Proxies cleared!')
      }
      else
      {
        await message.channel.send({embed: {
          title: "No config found!",
          description: `Please setup monitor!`
        }})
      }
      return
    }
    if(cmd === 'addkws')
    {
      let config = await Config.findOne()
      if(args[1] === undefined) return
      if(config)
      {
        let isAdded = false
        for(let i = 0; i < config.keywords.length; i++)
        {
          if(config.keywords[i] === args[1])
          {
            isAdded = true
          }
        }
        if(!isAdded)
        {
          config.keywords.push(args[1])
          await config.save()
          await message.channel.send(`\`\"${args[1]}\" added\``)
        }
        else
        {
          await message.channel.send(`\`\"${args[1]}\" already exists\``)
        }
        
      }
      else
      {
        await message.channel.send({embed: {
          title: "Server Not Authorized!",
          description: `Please authorize ${args[0]}`
        }})
      }
      return
    }
    if(cmd === 'removekws')
    {
      let config = await Config.findOne()
      if(args[1] === undefined) return
      if(config)
      {
        for(let i = 0; i < config.keywords.length; i++)
        {
          if(config.keywords[i] === args[1])
          {
            config.keywords.splice(i, 1)
            await config.save()
            await message.channel.send(`\`\"${args[1]}\" removed\``)
          }
        }
      }
      else
      {
        await message.channel.send({embed: {
          title: "No configuration found!",
          description: `Please configure by setting up a server!`
        }})
      }
      return
    }
    if(cmd === 'listkws')
    {
      let config = await Config.findOne()
      if(config)
      {
        if(config.keywords.length > 0)
        {
          await message.channel.send(`\Keywords:\n\`${config.keywords.join('\n')}\``)
        }
        else
        {
          await message.channel.send({embed: {
            title: "No Filters Set!",
            description: `Please add keywords to list!`
          }})
        }
        
      }
      else
      {
        await message.channel.send({embed: {
          title: "No configuration found!",
          description: `Please configure by setting up a server!`
        }})
      }
      return
    }


    
    // if(cmd === 'start' && message.channel.type !== 'dm')
    // {
    //   if(serverInfo.unfilterChannel && serverInfo.filteredChannel && serverInfo.logo)
    //   {
    //     if(!monitorStarted)
    //     {
    //       monitor = child_process.fork("./netaporter")
    //       monitor.send({type: 'start', serverID: message.guild.id})
    //       await message.channel.send({embed: {
    //         title: "Monitor started!"
    //       }})
    //       monitorStarted = true
    //       monitor.on('message', async data =>{
    //         if(data.source === 'Unfiltered')
    //         {
    //           //send to unfiltered channel
    //           let chnl = bot.channels.get(serverInfo.unfilterChannel)
    //           queue.push(()=>{chnl.send({embed: data.data})})
    //         }
    //         if(data.source === 'Filtered')
    //         {
    //           let chnl = bot.channels.get(serverInfo.filterChannel) 
    //           queue.push(()=>{chnl.send({embed: data.data})})
    //         }
    //       })
    //     }
    //   }
    //   else
    //   {
    //     await message.channel.send({embed: {
    //       title: "Server Not Setup!",
    //       description: `Please contact ${owner.tag}`
    //     }})
    //   }
    //   return
    // }
    // if(cmd === 'stop' && message.channel.type !== 'dm')
    // {
    //   if(monitorStarted)
    //   {
    //     monitor.kill()
    //     monitorStarted = false
    //     await message.channel.send({embed: {
    //       title: "Monitor stopped!"
    //     }})
    //   }
    //   return
    // }
  }
})
