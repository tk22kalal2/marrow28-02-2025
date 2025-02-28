let croppedImages = [];
let currentIndex = 0;

function processImage() {
    const input = document.getElementById('imageUpload');
    if (!input.files.length) return alert("Please upload an image!");

    const img = new Image();
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    img.onload = function () {
        detectQuestions(img);
    };
}

function detectQuestions(img) {
    Tesseract.recognize(img, 'eng').then(({ data }) => {
        let positions = [];
        let textLines = data.lines;

        textLines.forEach((line) => {
            if (line.text.match(/^\d+\./)) {
                positions.push(line.bbox.y0);
            }
        });

        positions.push(img.height);
        console.log("Detected positions:", positions);
        splitImage(img, positions);
    });
}

function splitImage(img, positions) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    croppedImages = [];
    currentIndex = 0;

    for (let i = 0; i < positions.length - 1; i++) {
        let y1 = positions[i];
        let y2 = positions[i + 1];
        let height = y2 - y1;

        canvas.width = img.width;
        canvas.height = height;
        ctx.drawImage(img, 0, y1, img.width, height, 0, 0, img.width, height);

        croppedImages.push(canvas.toDataURL("image/png"));
    }
    console.log("Cropped images count:", croppedImages.length);
    showNextImage();
}

function showNextImage() {
    if (currentIndex < croppedImages.length) {
        let outputImage = document.getElementById("outputImage");
        outputImage.src = croppedImages[currentIndex];
        outputImage.style.display = "block";

        document.getElementById("cropBtn").style.display = "block";
        document.getElementById("nextBtn").style.display = currentIndex < croppedImages.length - 1 ? "block" : "none";
        document.getElementById("makeQuestionBtn").style.display = "block";

        console.log("Displaying cropped image", currentIndex + 1);
        currentIndex++;
    }
}
