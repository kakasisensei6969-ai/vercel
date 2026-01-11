import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { message } = req.body;
    const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1459933538022457355/5B-sF-NdeOfrgaMCYdpTMcpgAhacJsAEwDE66zcVu6BPZxwu9X42dC_eRN6zr6sCtoID"; // এখানে লিঙ্কটি বসান

    const jsonPath = path.join(process.cwd(), 'data.json');
    const fileContents = fs.readFileSync(jsonPath, 'utf8');
    const myData = JSON.parse(fileContents);

    const systemInstruction = `
      তুমি একজন স্মার্ট অ্যাসিস্ট্যান্ট। তোমার নাম ${myData.bot_name}।
      তোমাকে তৈরি করেছেন ${myData.creator}।
      আমাদের অফিস: ${myData.office}।
      আমাদের সার্ভিসসমূহ: ${myData.services.join(', ')}।
      সাধারণ প্রশ্নোত্তর: ${JSON.stringify(myData.faq)}
      
      উপরের তথ্যের ভিত্তিতে উত্তর দাও। যদি প্রশ্নটি তথ্যের বাইরে হয়, তবে তোমার সাধারণ জ্ঞান ব্যবহার করো। ভাষা হবে বাংলা।
    `;

    // ডিসকর্ডে লগ পাঠানোর কমন ফাংশন
    const logToDiscord = async (userMsg, botReply, source) => {
      try {
        await fetch(DISCORD_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `**New Chat (${source})**\n**User:** ${userMsg}\n**Bot:** ${botReply}`
          })
        });
      } catch (e) { console.error("Discord Log Error", e); }
    };

    let finalReply = "";
    let finalSource = "";

    try {
      // ২. প্রথমে জেমিনি (Gemini) ট্রাই করবে
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\nইউজারের প্রশ্ন: ${message}` }] }]
        })
      });

      const geminiData = await geminiResponse.json();

      if (geminiData.candidates && geminiData.candidates[0]) {
        finalReply = geminiData.candidates[0].content.parts[0].text;
        finalSource = "Gemini";
      } else {
        throw new Error("Gemini Limit Reached");
      }

    } catch (geminiError) {
      console.log("Gemini failed, switching to Groq...");

      // ৩. জেমিনি ফেইল করলে গ্রক (Groq) ব্যাকআপ হিসেবে কাজ করবে
      const GROQ_API_KEY = process.env.GROQ_API_KEY;
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: message }
          ]
        })
      });

      const groqData = await groqResponse.json();
      finalReply = groqData.choices[0].message.content;
      finalSource = "Groq";
    }

    // --- এখান থেকে ডিসকর্ডে মেসেজ যাবে ---
    await logToDiscord(message, finalReply, finalSource);

    return res.status(200).json({ reply: finalReply, source: finalSource });

  } catch (error) {
    return res.status(500).json({ 
      reply: "দুঃখিত, আমি বর্তমানে কোনো সার্ভিস থেকেই উত্তর পাচ্ছি না।", 
      error: error.message 
    });
  }
}
