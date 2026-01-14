import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('Jadu Bot Telegram is Running!');

    try {
        const { message } = req.body;
        if (!message || !message.text) return res.status(200).send('No message');

        const chatId = message.chat.id;
        const userMsg = message.text;
        const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
        const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1459933538022457355/5B-sF-NdeOfrgaMCYdpTMcpgAhacJsAEwDE66zcVu6BPZxwu9X42dC_eRN6zr6sCtoID";

        // ১. ডাটা লোড করা
        const jsonPath = path.join(process.cwd(), 'data.json');
        const fileContents = fs.readFileSync(jsonPath, 'utf8');
        const myData = JSON.parse(fileContents);

        const systemInstruction = `
            তোমার নাম "${myData.bot_name}"। তুমি জাহিদুল ইসলামের (Jahidul Islam) তৈরি একজন স্মার্ট এআই অ্যাসিস্ট্যান্ট।
            পরিচয় সংক্রান্ত কঠোর নিয়ম:
            ১. তোমাকে প্রশ্ন করা হলে "তোমাকে কে বানিয়েছে?", তুমি বলবে: "আমাকে জাহিদুল ইসলাম তৈরি করেছেন।"
            ২. কখনোই বলবে না যে তুমি OpenAI, Google, ChatGPT বা Gemini-এর তৈরি। 
            ৩. অফিস: ${myData.office}।
            ৪. সার্ভিসসমূহ: ${myData.services.join(', ')}।
            ৫. FAQ ডাটা: ${JSON.stringify(myData.faq)}
            নির্দেশনা: উপরের ডাটা থেকে উত্তর দাও। ডাটাতে না থাকলে জাহিদুল ইসলামের তৈরি "জাদু বট" হিসেবে উত্তর দাও।
        `;

        // ডিসকর্ডে লগ পাঠানো
        const logToDiscord = async (u, b, s) => {
            try {
                await fetch(DISCORD_WEBHOOK, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: `**Telegram Chat (${s})**\n**User:** ${u}\n**Bot:** ${b}` })
                });
            } catch (e) { console.error(e); }
        };

        let finalReply = "";
        let finalSource = "";

        try {
            // ২. জেমিনি ট্রাই করা
            const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: `${systemInstruction}\n\nপ্রশ্ন: ${userMsg}` }] }] })
            });
            const geminiData = await geminiRes.json();
            finalReply = geminiData.candidates[0].content.parts[0].text;
            finalSource = "Gemini";
        } catch (err) {
            // ৩. গ্রক ট্রাই করা
            const GROQ_API_KEY = process.env.GROQ_API_KEY;
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama3-70b-8192",
                    messages: [{ role: "system", content: systemInstruction }, { role: "user", content: userMsg }]
                })
            });
            const groqData = await groqRes.json();
            finalReply = groqData.choices[0].message.content;
            finalSource = "Groq";
        }

        // ৪. টেলিগ্রামে মেসেজ পাঠানো
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: finalReply })
        });

        await logToDiscord(userMsg, finalReply, finalSource);
        return res.status(200).send('OK');

    } catch (error) {
        return res.status(200).send('Error');
    }
}
