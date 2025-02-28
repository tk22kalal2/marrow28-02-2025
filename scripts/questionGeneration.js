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
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "mixtral-8x7b-32768",
                messages: [
                    { 
                        role: "system", 
                        content: `Extract and format the given text into a structured question format. Strictly follow this structure:

                        **Question:** <Extracted question text>

                        **Options:**
                        A) ...
                        B) ...
                        C) ...
                        D) ...

                        **Correct Answer:** <Only the correct option letter (A/B/C/D)>

                        **Explanation:** <Brief explanation>

                        Ensure that the response is strictly in this format without any extra text.`
                    },
                    { role: "user", content: text }
                ],
                max_tokens: 300
            })
        });

        const result = await response.json();
        console.log("Groq API Response:", result);

        if (result.choices && result.choices.length > 0) {
            const output = result.choices[0].message.content;
            displayFormattedQuestion(output);
        } else {
            alert("Failed to generate the question.");
        }
    } catch (error) {
        console.error("Error fetching from Groq API:", error);
        alert("An error occurred while generating the question.");
    }
}

function displayFormattedQuestion(formattedText) {
    const questionFrame = document.getElementById("questionFrame");
    questionFrame.style.display = "block";

    const lines = formattedText.split("\n");
    let questionText = "";
    let options = [];
    let correctAnswer = "";
    let explanation = "";

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("**Question:**")) {
            questionText = lines[i].replace("**Question:**", "").trim();
        } else if (lines[i].startsWith("A)")) {
            options.push(lines[i]);
        } else if (lines[i].startsWith("B)")) {
            options.push(lines[i]);
        } else if (lines[i].startsWith("C)")) {
            options.push(lines[i]);
        } else if (lines[i].startsWith("D)")) {
            options.push(lines[i]);
        } else if (lines[i].startsWith("**Correct Answer:**")) {
            correctAnswer = lines[i].replace("**Correct Answer:**", "").trim();
        } else if (lines[i].startsWith("**Explanation:**")) {
            explanation = lines[i].replace("**Explanation:**", "").trim();
        }
    }

    document.getElementById("finalCroppedImage").src = document.getElementById("outputImage").src;
    document.getElementById("optionsList").innerHTML = options.map(opt => `<li>${opt}</li>`).join("");
    document.getElementById("correctAnswer").innerText = correctAnswer;
    document.getElementById("explanation").innerText = explanation;
}
