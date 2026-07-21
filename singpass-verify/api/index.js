require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const authRoutes = require('../src/routes/auth');
const verifyRoutes = require('../src/routes/verify');
const adminRoutes = require('../src/routes/admin');
const webhookRoutes = require('../src/routes/webhook');
const counterRoutes = require('../src/routes/counter');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'src', 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-secret'));
app.use('/public', express.static(path.join(__dirname, '..', 'src', 'public')));

app.use('/auth', authRoutes);
app.use('/verify', verifyRoutes);
app.use('/admin', adminRoutes);
app.use('/webhook', webhookRoutes);
app.use('/counter', counterRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', (req, res) => res.redirect('/verify'));

app.listen(PORT, () => {
  console.log(`JustRentLah Singpass Verification running on port ${PORT}`);
});

module.exports = app;
