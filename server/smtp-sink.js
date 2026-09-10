/**
 * A throwaway SMTP server that accepts one message and prints it.
 *
 *   node server/smtp-sink.js            # listens on 2525
 *   SMTP_HOST=localhost SMTP_PORT=2525 CONTACT_FROM=web@disetechcr.com npm run dev
 *
 * It exists so the whole path — form, endpoint, nodemailer, SMTP — can be run
 * for real without credentials or sending mail to anybody. It speaks just
 * enough of RFC 5321 to complete a session, and is not a mail server.
 */
import { createServer } from 'node:net';

const PORT = Number(process.env.SINK_PORT ?? 2525);

createServer((socket) => {
  let inData = false;
  let message = '';

  socket.write('220 disetech-sink ESMTP\r\n');

  socket.on('data', (chunk) => {
    for (const line of chunk.toString('utf8').split('\r\n')) {
      if (inData) {
        if (line === '.') {
          inData = false;
          console.log('\n===== MENSAJE RECIBIDO =====');
          console.log(message.trimEnd());
          console.log('============================\n');
          message = '';
          socket.write('250 2.0.0 Ok: queued\r\n');
        } else {
          // dot-stuffing: a leading '..' on the wire is a literal '.'
          message += `${line.startsWith('..') ? line.slice(1) : line}\n`;
        }
        continue;
      }

      if (!line) continue;
      const verb = line.split(' ')[0].toUpperCase();

      if (verb === 'EHLO' || verb === 'HELO') {
        // no STARTTLS and no AUTH advertised: this is a loopback sink
        socket.write('250-disetech-sink\r\n250 8BITMIME\r\n');
      } else if (verb === 'MAIL' || verb === 'RCPT' || verb === 'RSET' || verb === 'NOOP') {
        socket.write('250 2.1.0 Ok\r\n');
      } else if (verb === 'DATA') {
        inData = true;
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (verb === 'QUIT') {
        socket.write('221 2.0.0 Bye\r\n');
        socket.end();
      } else {
        socket.write('502 5.5.2 Command not implemented\r\n');
      }
    }
  });

  socket.on('error', () => {});
}).listen(PORT, () => console.log(`SMTP sink escuchando en localhost:${PORT}`));
