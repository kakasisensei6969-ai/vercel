import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('Jadu Bot Telegram is Active!');
    }

    try {
        const { message } = req.body;
        if (!message || !message.text) {
            return res.status(200).json({ status: "no_text" });
        }

        // --- ইউজারের তথ্য সংগ্রহ ---
        const chatId = message.chat.id;
        const userMsg = message.text;
        const firstName = message.from.first_name || "Unknown";
        const userName = message.from.username ? `@${message.from.username}` : "No Username";
        
        const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
        const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1459933538022457355/5B-sF-NdeOfrgaMCYdpTMcpgAhacJsAEwDE66zcVu6BPZxwu9X42dC_eRN6zr6sCtoID";

        // ১. ডাটা লোড করা
        const jsonPath = path.join(process.cwd(), 'data.json');
        const fileContents = fs.readFileSync(jsonPath, 'utf8');
        const myData = JSON.parse(fileContents);

        const systemInstruction = `তোমার নাম "${myData.bot_name}"। তোমাকে জাহিদুল ইসলাম (Jahidul Islam) তৈরি করেছেন । আসসালামু আলাইকুম! দিবে, নমস্কার করবে না । পরিচয় নিয়ম: কখনো বলবে না তুমি OpenAI বা Google-এর তৈরি। তোমার অফিস: ${myData.office}। FAQ ডাটা: ${JSON.stringify(myData.faq)}`;

        let finalReply = "";
        let finalSource = "";

        // ২. এআই লজিক (Gemini -> Groq)
        try {
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemInstruction}\n\nইউজার: ${userMsg}` }] }]
                })
            });
            const geminiData = await geminiRes.json();
            finalReply = geminiData.candidates[0].content.parts[0].text;
            finalSource = "Gemini";
        } catch (err) {
            try {
                const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "openai/gpt-oss-120b",
                        messages: [
                            { role: "system", content: systemInstruction },
                            { role: "user", content: userMsg }
                        ]
                    })
                });
                const groqData = await groqRes.json();
                finalReply = groqData.choices[0].message.content;
                finalSource = "Groq";
            } catch (groqErr) {
                finalReply = "আমি এটি নিয়ে বলতে পারছিনা বলে দুঃখিত । অন্য কী জানতে চাও বলো..";
                finalSource = "Error";
            }
        }

        // ৩. টেলিগ্রামে রিপ্লাই পাঠানো
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: finalReply })
        });

        // ৪. ডিসকর্ডে বিস্তারিত লগ পাঠানো (এখানেই নাম যোগ করা হয়েছে)
        fetch(DISCORD_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                content: `**🔔 New Telegram Chat**\n` +
                         `**User:** ${firstName} (${userName})\n` +
                         `**ID:** ${chatId}\n` +
                         `**Message:** ${userMsg}\n` +
                         `**Bot (${finalSource}):** ${finalReply}\n` +
                         `---`
            })
        }).catch(e => console.log("Discord error"));

        return res.status(200).json({ status: "success" });

    } catch (error) {
        console.error("Error:", error);
        return res.status(200).json({ status: "error" });
    }
}
