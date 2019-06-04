const mongoose = require('mongoose');

var errorSchema = new mongoose.Schema({
    time:{type:String, default: Date.now()},
    error:{type:String, required: true},
    operation:{type:String},
});

module.exports = mongoose.model('Errors',errorSchema);
