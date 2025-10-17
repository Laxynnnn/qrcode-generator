// frontend/netlify/functions/generate.js

const mongoose = require('mongoose');
const QRCode = require('qrcode');

// Variabel MONGO_URI akan diisi dari pengaturan Environment Variable di Netlify
const MONGO_URI = process.env.MONGO_URI;

// ====== Mongoose Schema (ditempatkan di sini) ======
// Skema harus didefinisikan di sini karena ini adalah file backend satu-satunya
const qrSchema = new mongoose.Schema({
  text: String,
  template: String,
  color: String,
  qrCode: String,
  generatedAt: { type: Date, default: Date.now }
});

// Gunakan nama model yang sama untuk menghindari konflik
// Anda mungkin perlu menambahkan { overwriteModels: true } jika Netlify crash, tapi coba tanpa itu dulu
const QrModel = mongoose.model("History", qrSchema);

// Fungsi utama yang dipanggil oleh Netlify
exports.handler = async (event, context) => {
  // Pastikan hanya menerima permintaan POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method Not Allowed' })
    };
  }

  try {
    // 1. Ambil Data dari Frontend
    const data = JSON.parse(event.body);
    const { text, template, color } = data;

    if (!text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Text is required' })
      };
    }

    // 2. Hubungkan ke Database (hanya jika belum terhubung)
    // Koneksi di luar handler akan menyebabkan masalah di serverless, jadi kita cek di sini
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }

    // 3. Generate QR (base64)
    const qrCode = await QRCode.toDataURL(text, {
      color: {
        dark: color || "#000000",
        light: "#FFFFFF"
      }
    });

    // 4. Save to MongoDB
    const newQR = new QrModel({
      text,
      template: template || "default",
      color: color || "#000000",
      qrCode
    });

    await newQR.save();

    // 5. Beri Respon ke Frontend
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, qrCode: qrCode })
    };

  } catch (err) {
    console.error("Error generating QR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Failed to generate QR Code: ${err.message}' })
    };
  }
};