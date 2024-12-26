const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const readline = require('readline');
const cliProgress = require('cli-progress');
const path = require('path');
const chalk = require('chalk');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const outputDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const logo = 'Strecord\'a Hoş Geldiniz!';

function clearScreen() {
    process.stdout.write('\x1Bc');
}

function typeLogo() {
    return new Promise((resolve) => {
        let index = 0;
        const interval = setInterval(() => {
            process.stdout.write(logo[index]);
            index++;
            if (index === logo.length) {
                clearInterval(interval);
                setTimeout(resolve, 1000);
            }
        }, 50);
    });
}

async function checkStreamType(url) {
    try {
        const response = await axios.head(url);
        const contentType = response.headers['content-type'];
        return contentType.includes('audio') ? 'radio' : 'tv';
    } catch (error) {
        throw new Error('URL kontrol edilemedi. Geçerli URL Girdiğinizden emin olun!');
    }
}

function validateTime(timeString) {
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
    if (!timeRegex.test(timeString)) {
        throw new Error('Geçersiz zaman formatı! Lütfen HH:MM:SS formatında girin. (örn: 01:30:20)');
    }
    return true;
}

function timeToSeconds(timeString) {
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    return (hours * 3600) + (minutes * 60) + seconds;
}

function getUniqueFilename(baseName, ext) {
    let fileName = baseName + ext;
    let counter = 1;

    while (fs.existsSync(path.join(outputDir, fileName))) {
        fileName = `${baseName}-${counter}${ext}`;
        counter++;
    }

    return path.join(outputDir, fileName);
}

async function startRecording() {
    try {
        clearScreen();
        await typeLogo();

        const url = await new Promise(resolve => {
            rl.question(chalk.bold.yellow('Yayın URL\'sini girin: '), resolve);
        });

        const duration = await new Promise(resolve => {
            rl.question(chalk.bold.yellow('Kayıt süresini girin (HH:MM:SS): '), resolve);
        });

        validateTime(duration);

        const projectName = await new Promise(resolve => {
            rl.question(chalk.bold.yellow('Dosya adı girin: '), resolve);
        });

        if (!projectName) {
            throw new Error('Hata: Dosya adı boş olamaz!');
        }

        const streamType = await checkStreamType(url);
        const outputFormat = streamType === 'radio' ? 'mp3' : 'mp4';

        const outputFile = getUniqueFilename(projectName, `.${outputFormat}`);

        console.log(`Kayıt başladı... (${duration})`);

        const totalSeconds = timeToSeconds(duration);
        const startTime = Date.now();
        const progressBar = new cliProgress.SingleBar({
            format: 'Kayıt İlerlemesi: {bar} {percentage}% || Geçen Süre: {elapsed}s // Kalan Süre: {remaining}s',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591'
        });

        progressBar.start(100, 0);

        ffmpeg(url)
            .duration(totalSeconds)
            .output(outputFile)
            .on('progress', (progress) => {
                const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
                const remainingTime = Math.max(totalSeconds - elapsedTime, 0);

                const percent = Math.min((elapsedTime / totalSeconds) * 100, 100);

                progressBar.update(percent, {
                    elapsed: elapsedTime,
                    remaining: remainingTime
                });
            })
            .on('end', () => {
                progressBar.update(100, {
                    elapsed: totalSeconds,
                    remaining: 0
                });
                progressBar.stop();
                console.log(chalk.green('Kayıt tamamlandı!\nKaydedilen Dosya: '), chalk.blue(outputFile));
                rl.close();
            })
            .on('error', (err) => {
                progressBar.stop();
                console.error('Kayıt sırasında hata oluştu:', err);
                rl.close();
            })
            .run();

    } catch (error) {
        console.error('Hata:', error.message);
        rl.close();
    }
}

startRecording();
