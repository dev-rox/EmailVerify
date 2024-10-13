let {
  smtpHost,
  email,
  username,
  password,
  isGoogle,
  isSecure,
  smtpPort,
} = require('../../config/config.json');

const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const { defaultLanguage, getLocale } = require('../Language');
const database = require('../database/Database');
const fs = require('fs'); // Importar módulo fs para ler arquivos
const path = require('path'); // Para facilitar o uso de paths

if (typeof username === 'undefined') {
  username = email;
}

module.exports = class MailSender {
  constructor(userGuilds, serverStatsAPI) {
    this.userGuilds = userGuilds;
    this.serverStatsAPI = serverStatsAPI;
    let nodemailerOptions = {
      host: smtpHost,
      auth: {
        user: username,
        pass: password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    };
    if (isGoogle) nodemailerOptions['service'] = 'gmail';
    if (isSecure) nodemailerOptions['secure'] = isSecure;
    if (smtpPort) nodemailerOptions['port'] = smtpPort;

    this.transporter = nodemailer.createTransport(
      smtpTransport(nodemailerOptions)
    );
  }

  async sendEmail(toEmail, code, name, message, emailNotify, callback) {
    await database.getServerSettings(
      this.userGuilds.get(message.author.id).id,
      (serverSettings) => {
        // Caminho do arquivo HTML
        const templatePath = path.join(__dirname, 'emailTemplate.html');

        // Ler o arquivo HTML
        let emailHTML = fs.readFileSync(templatePath, 'utf-8');

        // Substituir os placeholders %NAME% e %CODE% pelas variáveis name e code
        emailHTML = emailHTML.replace(/%NAME%/g, name).replace(/%CODE%/g, code);

        const mailOptions = {
          from: '"PUCPR Connect Bot ✉️" <' + email + '>',
          to: toEmail,
          subject: 'Código de verificação ' + name,
          html: emailHTML, // Corpo do e-mail agora é o HTML com placeholders substituídos
        };

        if (!isGoogle) mailOptions['bcc'] = email;

        let language = '';
        try {
          language = serverSettings.language;
        } catch {
          language = defaultLanguage;
        }

        this.transporter.sendMail(mailOptions, async (error, info) => {
          if (error || info.rejected.length > 0) {
            if (emailNotify) {
              console.log(error);
            }
            await message.reply(getLocale(language, 'mailNegative', toEmail));
          } else {
            this.serverStatsAPI.increaseMailSend();
            callback(info.accepted[0]);
            await message.reply(getLocale(language, 'mailPositive', toEmail));
            if (emailNotify) {
              console.log(
                'Email sent to: ' + toEmail + ', Info: ' + info.response
              );
            }
          }
        });
      }
    );
  }
};
