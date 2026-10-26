const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://localhost:27017/fexa-project');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    const Product = mongoose.model('Product', new mongoose.Schema({}, {strict: false}));
    const count = await Product.countDocuments();
    const cats = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } } } }
    ]);
    console.log('Total products:', count);
    console.log('Category distribution:', JSON.stringify(cats, null, 2));

    // Check if category collection exists
    if (collections.some(c => c.name === 'categories')) {
      const Category = mongoose.model('Category', new mongoose.Schema({}, {strict: false}));
      const existingCategories = await Category.find();
      console.log('Existing categories:', JSON.stringify(existingCategories, null, 2));
    } else {
      console.log('No categories collection found.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
