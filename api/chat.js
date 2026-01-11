import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { message } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    // JSON ফাইলটি পড়ার নিয়ম
    const jsonPath = path.join(process.cwd(), 'data.json');
    const fileContents = fs.readFileSync(jsonPath, 'utf8');
    const myData = JSON.parse(fileContents);

    // জেমিনিকে দেওয়ার জন্য ইন্সট্রাকশন তৈরি
    const context = `
      তুমি একজন স্মার্ট অ্যাসিস্ট্যান্ট। তোমার নাম ${myData.bot_name}।
      তোমাকে তৈরি করেছেন ${myData.creator}।
      আমাদের অফিস: ${myData.office}।
      আমাদের সার্ভিসসমূহ: ${myData.services.join(', ')}।
      কিছু সাধারণ প্রশ্নোত্তর: ${JSON.stringify(myData.faq)}
      
      উপরের তথ্যের ভিত্তিতে উত্তর দাও। যদি প্রশ্নটি এই তথ্যের বাইরে হয়, তবে তোমার সাধারণ জ্ঞান ব্যবহার করো। ভাষা হবে বাংলা।
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${context}\n\nUser Question: ${message}` }] }]
      })
    });

    const data = await response.json();
    const botReply = data.candidates[0].content.parts[0].text;

    return res.status(200).json({ reply: botReply });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
