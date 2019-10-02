const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    productID: {
        type: String,
    },
    productName: {
        type: String,
    },
    productSizes: [{
      sizeName: {type: String, },
      stockLevel: {type: String, }
    }
    ]
});

module.exports = mongoose.model('product', productSchema);