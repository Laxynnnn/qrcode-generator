// netlify/functions/generate.js

const mongoose = require('mongoose');
const QRCode = require('qrcode');

// Ambil MONGO_URI dari environment variable
const MONGO_URI = process.env.MONGO_URI;

// Schema untuk QR Code History
const qrSchema = new mongoose.Schema({
  text: String,
  template: String,
  color: String,
  qrCode: String,
  generatedAt: { type: Date, default: Date.now }
});

// Buat model (cek dulu apakah sudah ada untuk hindari error)
const QrModel = mongoose.models.History || mongoose.model("History", qrSchema);

// Handler function untuk Netlify
exports.handler = async (event, context) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: 'Method Not Allowed' })
    };
  }

  try {
    // Parse request body
    const data = JSON.parse(event.body);
    const { text, template, color } = data;

    console.log('Received data:', { text, template, color });

    // Validasi input
    if (!text) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Text is required' })
      };
    }

    // Koneksi ke MongoDB (hanya jika belum connected)
    if (mongoose.connection.readyState !== 1) {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('MongoDB connected');
    }

    // Generate QR Code (base64)
    const qrCode = await QRCode.toDataURL(text, {
      color: {
        dark: color || "#000000",
        light: "#FFFFFF"
      },
      width: 300,
      margin: 2
    });

    console.log('QR Code generated');

    // Save to MongoDB
    const newQR = new QrModel({
      text,
      template: template || "default",
      color: color || "#000000",
      qrCode
    });

    await newQR.save();
    console.log('Saved to database');

    // Return response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, qrCode: qrCode })
    };

  } catch (err) {
    console.error("Error generating QR:", err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        message: 'Failed to generate QR Code: ${err.message}' 
      })
    };
  }
}