const configData = require('./config');
const webhook = require('webhook-discord');
const hooman = require('hooman');
const JSSoup = require('jssoup').default;
const winston = require('winston');
const CommentHook = new webhook.Webhook(configData.webhook);
const UpdateHook = new webhook.Webhook(configData.webhook2);
const ENDING = 'page/5000/';
const THREADS = configData.threads;
const CACHE = configData.cache;
const ICONS = configData.icons;

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

const getRandomColor = () => {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
};

const timeout = millis => new Promise(resolve => setTimeout(resolve, millis));

const sendCommentMessage = (script, thread, date, author, message) => {
    // Discords validations on fields.
    if (message.length > 1024)
        return;

    if (author === configData.name) {
        const messageBuilder = new webhook.MessageBuilder()
            .setName('Updates')
            .setTitle(script)
            .setAvatar('https://i.imgur.com/krPavyD.gif')
            .setColor(getRandomColor())
            .setThumbnail(ICONS[script])
            .addField('Update Information', message)
            .addField('Thread Link', thread)
            .addField('Date', date);
        UpdateHook.send(messageBuilder);
    } else {
        const messageBuilder = new webhook.MessageBuilder()
            .setName(configData.botname)
            .setTitle(script)
            .setColor(getRandomColor())
            .addField('Comment', message)
            .addField('Thread Link', thread)
            .addField('Author', author)
            .addField('Date', date);
        CommentHook.send(messageBuilder);
    }
};

(async function main() {
    logger.info('Starting comment_watcher_bot application. ' + new Date().toString());
    while (true) {
        for (idx in THREADS) {
            const url = THREADS[idx].concat(ENDING);
            const source = await hooman.get(url);

            if (source) {
                const soup = new JSSoup(source.body);
                const script = soup.find('script', {'type': 'application/ld+json'}).text;
                const json = JSON.parse(script);
                const scriptName = json['name'];
                const comments = json['comment'];

                logger.info(`Loading comments for ${scriptName}`);

                comments.forEach(function (data) {
                    const date = new Date(data['dateCreated']).toString();
                    const author = data['author'].name;
                    const thread = data['url'];
                    const message = data['text'];
                    const commentCount = thread.substring(thread.indexOf('comment') + 8, thread.length);

                    if (author === configData.name && !message.includes('UPDATE'))
                        return;

                    if (commentCount > CACHE[scriptName]) {
                        logger.info(`Found a recent comment by user ${author} on topic [${scriptName}][${date}].`);
                        CACHE[scriptName] = commentCount;
                        sendCommentMessage(scriptName, thread, date, author, message);
                    }
                });
            }
        }
        // Delay next thread check
        logger.info('Waiting a bit for next cycle');
        await timeout(configData.timeout);
    }
})();
