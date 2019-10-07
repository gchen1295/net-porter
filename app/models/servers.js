const mongoose = require('mongoose')

let serverSchema = mongoose.Schema({
  serverID: {type: String, default: undefined},
  serverName: {type: String, default: undefined},
  authorizedUsers: [String],
  //unfilterChannel: {type: String, default: undefined},
  //unfilterChannelWH: {type: String, default: undefined},
  //filteredChannel: {type: String, default: undefined},
  //filteredChannelWH: {type: String, default: undefined},
  color: {type: String, default: '#ff0000'},
  logo: {type: String, default: undefined},
  keywords: [String],
  proxies: [String],
  setupDone: {type: Boolean, default: false},
  //activeSub: {type: Boolean, default: false}
})
//new Date(+new Date() + 30*24*60*60*1000)
module.exports = mongoose.model('Server',serverSchema)