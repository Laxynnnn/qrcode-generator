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

// Koneksi ke MongoDB (di luar handler untuk reuse connection)
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    console.log('Using cached database connection');
    return cachedDb;
  }

  console.log('Creating new database connection');
  
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout setelah 5 detik
      socketTimeoutMS: 45000,
    });
    
    cachedDb = mongoose.connection;
    console.log('MongoDB connected successfully');
    return cachedDb;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Handler function untuk Netlify
exports.handler = async (event, context) => {
  // Penting untuk serverless functions
  context.callbackWaitsForEmptyEventLoop = false;

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
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
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success: false, message: 'Text is required' })
      };
    }

    // Koneksi ke MongoDB
    await connectToDatabase();

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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, qrCode: qrCode })
    };

  } catch (err) {
    console.error("Error generating QR:", err);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false, 
        message: 'Failed to generate QR Code: ${err.message}' 
      })
    };
  }
}