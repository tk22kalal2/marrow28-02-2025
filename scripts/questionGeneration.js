const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "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";

async function makeQuestion() {
    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) {
        alert("No image displayed to extract text!");
        return;
    }

    const worker = Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    const { data: { text } } = await worker.recognize(outputImage);
    await worker.terminate();

    if (!text.trim()) {
        alert("No text detected. Please use a clearer image.");
        return;
    }

    console.log("Extracted Text:", text);
    getFormattedQuestion(text);
}

async function getFormattedQuestion(text) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "mixtral-8x7b-32768",
            messages: [
                { role: "system", content: "Extract and format the given text into a structured question format: \n\nQuestion:\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer:\nExplanation:" },
                { role: "user", content: text }
            ],
            max_tokens: 300
        })
    });

    const result = await response.json();
    if (result.choices && result.choices.length > 0) {
        document.getElementById("generatedQuestion").innerText = result.choices[0].message.content;
    } else {
        alert("Failed to generate the question.");
    }
}
