const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000; 

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(__dirname));

// 🔌 کلاؤڈ ڈیٹا بیس کنکشن
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/cotton_studio";
mongoose.connect(mongoURI)
    .then(() => console.log("☁️ Cloud Database Connected Successfully!"))
    .catch(err => console.log("Database Connection Waiting/Local Mode...", err));

// 📁 ڈیٹا بیس اسکیما (Mongoose Models)
const DataSchema = new mongoose.Schema({ id: String, name: String, phone: String, address: String, status: String, balance: Number, transactions: Array });
const Party = mongoose.model('Party', DataSchema);

const LogSchema = new mongoose.Schema({ date: String, narration: String, method: String, type: String, amount: Number });
const DayLog = mongoose.model('DayLog', LogSchema);

// 🏠 فرنٹ اینڈ ہوم روٹ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🚨 🚨 🚨 [MASTER RESET] پورے کلاؤڈ ڈیٹا بیس کو صاف کرنے کا اینڈ پوائنٹ 🚨 🚨 🚨
app.post('/api/master-reset', async (req, res) => {
    try {
        const { pin } = req.body;
        
        // سیکیورٹی پن کوڈ میچنگ (Security Check)
        if (pin !== "1122") {
            return res.status(401).json({ success: false, message: "غلط سیکیورٹی پن کوڈ! ڈیٹا ڈیلیٹ نہیں کیا جا سکتا۔" });
        }

        // کلاؤڈ ڈیٹا بیس کی تمام کلیکشنز کو ایک کلک میں خالی کرنا
        await Party.deleteMany({});
        await DayLog.deleteMany({});
        
        console.log("💥 Full Cloud Database Wiped Out by Owner!");
        res.json({ success: true, message: "پورا کلاؤڈ ڈیٹا بیس کامیابی سے صاف کر دیا گیا ہے!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "سرور کا مسئلہ ہے!", error: error.message });
    }
});

// --- 📊 DASHBOARD ENDPOINT ---
app.get('/api/dashboard', async (req, res) => {
    try {
        const logs = await DayLog.find().sort({ _id: -1 }).limit(50);
        const customers = await Party.find({ id: { $regex: /^cust_/ } });
        let totalReceivables = 0;
        customers.forEach(c => { if(c.balance > 0) totalReceivables += c.balance; });

        res.json({
            summary: { netProfit: 0, totalSales: 0, receivables: totalReceivables },
            daybook: logs
        });
    } catch (error) { res.status(500).json({ success: false }); }
});

// --- 👥 CUSTOMERS ENDPOINTS ---
app.get('/api/customers', async (req, res) => {
    const custs = await Party.find({ id: { $regex: /^cust_/ } });
    res.json(custs);
});
app.post('/api/customers', async (req, res) => {
    let newCust = new Party({ id: "cust_" + Date.now(), name: req.body.name, phone: req.body.phone || "N/A", address: req.body.address || "", status: req.body.status || "Active", balance: 0, transactions: [] });
    await newCust.save(); res.json({ success: true, customer: newCust });
});
app.post('/api/customers/recovery', async (req, res) => {
    const { customerId, amount, method, desc } = req.body;
    let c = await Party.findOne({ id: customerId });
    if(c) {
        c.balance -= parseFloat(amount);
        c.transactions.push({ date: new Date().toISOString().split('T')[0], description: desc || "Recovery Cash", method: method || "Cash", debit: 0, credit: parseFloat(amount), balance: c.balance });
        await Party.updateOne({ id: customerId }, { balance: c.balance, transactions: c.transactions });
        let log = new DayLog({ date: new Date().toISOString().split('T')[0], narration: `Recovery from ${c.name}`, method: method, type: "income", amount: parseFloat(amount) });
        await log.save();
    }
    res.json({ success: true });
});
app.delete('/api/:endpoint/:id', async (req, res) => {
    await Party.deleteOne({ id: req.params.id }); res.json({ success: true });
});

// --- 🏭 VENDORS ENDPOINTS ---
app.get('/api/vendors', async (req, res) => { res.json(await Party.find({ id: { $regex: /^vend_/ } })); });
app.post('/api/vendors', async (req, res) => {
    let newVendor = new Party({ id: "vend_" + Date.now(), name: req.body.name, phone: req.body.phone || "N/A", address: req.body.address || "", status: req.body.status || "Active", balance: 0, transactions: [] });
    await newVendor.save(); res.json({ success: true });
});

// --- 🧾 INVENTORY & CHECKOUT ---
app.get('/api/inventory', (req, res) => {
    res.json([
        { id: "p1", name: "Premium Wash & Wear", sellingPrice: 3500 },
        { id: "p2", name: "Royal Cotton Soft", sellingPrice: 4200 },
        { id: "p3", name: "Executive Karandi", sellingPrice: 5500 }
    ]);
});
app.post('/api/invoices/checkout', async (req, res) => {
    const { customerId, cashPaid, udharAmount, paymentMethod } = req.body;
    let c = await Party.findOne({ id: customerId });
    let invId = "INV-" + Math.floor(1000 + Math.random() * 9000);
    if(c) {
        c.balance += parseFloat(udharAmount);
        c.transactions.push({ date: new Date().toISOString().split('T')[0], description: `Invoice #${invId}`, method: paymentMethod, debit: parseFloat(udharAmount) + parseFloat(cashPaid), credit: parseFloat(cashPaid), balance: c.balance });
        await Party.updateOne({ id: customerId }, { balance: c.balance, transactions: c.transactions });
        if(cashPaid > 0) {
            let log = new DayLog({ date: new Date().toISOString().split('T')[0], narration: `Sales Cash (Inv #${invId})`, method: paymentMethod, type: "income", amount: parseFloat(cashPaid) });
            await log.save();
        }
    }
    res.json({ success: true, invoiceId: invId });
});

// --- 🪡 STITCHERS & EMPLOYEES ---
app.get('/api/stitchers', async (req, res) => { res.json(await Party.find({ id: { $regex: /^stc_/ } })); });
app.post('/api/stitchers', async (req, res) => {
    let newStc = new Party({ id: "stc_" + Date.now(), name: req.body.name, phone: req.body.phone, rate: req.body.rate, status: req.body.status, balance: 0, transactions: [] });
    await newStc.save(); res.json({ success: true });
});
app.get('/api/staff', async (req, res) => { res.json(await Party.find({ id: { $regex: /^stf_/ } })); });
app.post('/api/staff', async (req, res) => {
    let newStf = new Party({ id: "stf_" + Date.now(), name: req.body.name, salary: req.body.salary, phone: req.body.phone, status: req.body.status, balance: 0, transactions: [] });
    await newStf.save(); res.json({ success: true });
});

// --- 💸 EXPENSES ---
app.get('/api/expenses', async (req, res) => { res.json(await DayLog.find({ type: "expense" }).sort({ _id: -1 })); });
app.post('/api/expenses', async (req, res) => {
    let log = new DayLog({ date: new Date().toISOString().split('T')[0], narration: req.body.description, method: req.body.method, type: "expense", amount: parseFloat(req.body.amount) });
    await log.save(); res.json({ success: true });
});

app.listen(PORT, () => { console.log(`🚀 Cloud Server Live on Port ${PORT}`); });