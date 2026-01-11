export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `তুমি একজন স্মার্ট চ্যাটবট। বাংলায় কথা বলো।\nUser: ${message}` }]
        }]
      })
    });

    const data = await response.json();
    const botReply = data.candidates[0].content.parts[0].text;

    return res.status(200).json({ reply: botReply });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
