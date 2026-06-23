const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 🔗 Connect to MongoDB Cloud Database
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ Error: MONGO_URI Environment Variable is missing on Render!");
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => console.log('🚀 Connected to MongoDB Cloud Successfully!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 📝 Customer Schema & Model
const customerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: String,
    address: String,
    balance: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Customer = mongoose.model('Customer', customerSchema);

// 🌐 API Routes

// 1. Get all customers
app.get('/api/customers', async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: -1 });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customers', error: error.message });
    }
});

// 2. Add a new customer (Proper MongoDB Save)
app.post('/api/customers', async (req, res) => {
    try {
        const { name, phone, address, balance } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Customer name is required' });
        }
        
        const newCustomer = new Customer({
            name,
            phone,
            address,
            balance: balance ? parseFloat(balance) : 0
        });

        const savedCustomer = await Customer.save();
        res.status(201).json(savedCustomer);
    } catch (error) {
        res.status(500).json({ message: 'Error adding customer', error: error.message });
    }
});

// 3. Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Cloud Server Live on Port ${PORT}`);
});
