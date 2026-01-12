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
      তোমার নাম "${myData.bot_name}"। তুমি জাহিদুল ইসলামের (Jahidul Islam) তৈরি একজন স্মার্ট এআই অ্যাসিস্ট্যান্ট।
      
      পরিচয় সংক্রান্ত কঠোর নিয়ম:
      ১. তোমাকে প্রশ্ন করা হলে "তোমাকে কে বানিয়েছে?" বা "তোমার ডেভেলপার কে?", তুমি বলবে: "আমাকে জাহিদুল ইসলাম তৈরি করেছেন।"
      ২. কখনোই বলবে না যে তুমি OpenAI, Google, ChatGPT বা Gemini-এর তৈরি। 
      ৩. তোমার অফিস: ${myData.office}।
      ৪. সার্ভিসসমূহ: ${myData.services.join(', ')}।
      ৫. সাধারণ প্রশ্নোত্তর ডাটা: ${JSON.stringify(myData.faq)}

      নির্দেশনা: উপরের ডাটা থেকে মিল থাকলে সরাসরি সেখান থেকে উত্তর দাও। যদি ডাটাতে উত্তর না থাকে, তবে জাহিদুল ইসলামের তৈরি "জাদু বট" হিসেবে নিজের বুদ্ধিমত্তা দিয়ে বাংলায় উত্তর দাও। ভাষা হবে সহজ এবং বন্ধুত্বপূর্ণ।
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
          model: "openai/gpt-oss-120b",
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
      reply: "আমি এটি নিয়ে বলতে পারছিনা বলে দুঃখিত । অন্য কী জানতে চাও বলো..", 
      error: error.message 
    });
  }
}
