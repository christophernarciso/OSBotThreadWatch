const configData = require('./config');
const webhook = require('webhook-discord');
const cloudscraper = require('cloudscraper');
const JSSoup = require('jssoup').default;
const Hook = new webhook.Webhook(configData.webhook);
const ENDING = 'page/5000/';
const THREADS = configData.threads;
const DATE_CACHE = configData.cache;

const getRandomColor = () => {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
};

const timeout = millis => new Promise(resolve => setTimeout(resolve, millis));

const sendMessage = (script, thread, date, author, message) => {
    if (date === null) {
        const messageBuilder = new webhook.MessageBuilder()
            .setName(configData.botname)
            .setColor(getRandomColor())
            .addField('Date', new Date().toString())
            .addField('Author', author)
            .addField('Message', message);
        return Hook.send(messageBuilder);
    }

    const messageBuilder = new webhook.MessageBuilder()
        .setName(configData.botname)
        .setColor(getRandomColor())
        .addField('Topic', script)
        .addField('Thread Link', thread)
        .addField('Author', author)
        .addField('Comment', message)
        .addField('Date', new Date(date).toString());

    Hook.send(messageBuilder);
};

(async function main() {
    sendMessage(null, null, null, configData.name, configData.start.concat(` version: ${configData.version}`, ` timeout(ms): ${configData.timeout}`));
    while (true) {
        for (idx in THREADS) {
            const url = THREADS[idx].concat(ENDING);
            const source = await cloudscraper.get(url);

            if (source) {
                const soup = new JSSoup(source);
                const t = soup.find('script', {
                    'type': 'application/ld+json'
                }).text;
                const json = JSON.parse(t);
                const scriptName = json['name'];
                const comments = json['comment'];

                console.log(`Loading comments for ${scriptName}`);

                comments.forEach(function (data) {
                    const date = new Date(data['dateCreated']).getTime();
                    const author = data['author'].name;
                    const thread = data['url'];
                    const message = data['text'];

                    if (author === configData.name)
                        return;

                    if (date > DATE_CACHE[scriptName]) {
                        console.log(`Found a recent comment by user ${author} on topic [${scriptName}][${date}].`);
                        DATE_CACHE[scriptName] = date;
                        sendMessage(scriptName, thread, date, author, message);
                    }
                });
            }
        }
        // Delay next thread check
        console.log('Waiting a bit for next cycle');
        await timeout(configData.timeout);
    }
})();
