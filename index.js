const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();

const corsOptions = { origin: '*', methods: "GET,HEAD,PUT,PATCH,POST,DELETE", preflightContinue: false, optionsSuccessStatus: 204 };
app.use(cors(corsOptions));
app.use(express.json());

// --- Logowanie i Autentykacja ---
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password && password === process.env.APP_PASSWORD) {
    const token = jwt.sign({ access: 'granted' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Nieprawidłowe hasło' });
  }
});
const auth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.status(401).json({ error: 'Brak autoryzacji' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token nieprawidłowy' });
    req.user = user;
    next();
  });
};

// ===================================
// ===     API: Magazyn (ERP)      ===
// ===================================

app.get('/api/product-categories', auth, async (req, res) => {
    const categories = await prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
});

app.post('/api/product-categories', auth, async (req, res) => {
    const { name } = req.body;
    const newCategory = await prisma.productCategory.create({ data: { name } });
    res.status(201).json(newCategory);
});

app.get('/api/products', auth, async (req, res) => {
  const products = await prisma.product.findMany({ include: { category: true }, orderBy: { name: 'asc' } });
  res.json(products);
});

app.post('/api/products', auth, async (req, res) => {
    const { categoryId, name, unit, manufacturer, materialType, color, diameter } = req.body;
    const category = await prisma.productCategory.findUnique({ where: { id: parseInt(categoryId) } });

    let productName = name;
    let productUnit = unit;

    if (category && category.name.toLowerCase() === 'filament') {
        productName = `${manufacturer} ${materialType} ${color}`;
        productUnit = 'g';
    }

    try {
        const newProduct = await prisma.product.create({ 
            data: { 
                name: productName, 
                unit: productUnit, 
                categoryId: parseInt(categoryId),
                manufacturer, materialType, color, 
                diameter: diameter ? parseFloat(diameter) : null 
            }
        });
        res.status(201).json(newProduct);
    } catch (e) {
        if (e.code === 'P2002') {
            res.status(409).json({ error: `Produkt o nazwie "${productName}" już istnieje.`});
        } else {
            console.error(e);
            res.status(500).json({ error: "Nie udało się utworzyć produktu." });
        }
    }
});

// TODO: Dodać resztę endpointów (zakupy, klienci, zamówienia itd.)

// ===================================
// ===     URUCHOMIENIE SERWERA     ===
// ===================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serwer uruchomiony na porcie ${PORT}`);
});