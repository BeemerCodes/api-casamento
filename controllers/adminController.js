const {
  getApprovedPendingGuests,
  markGuestAsNotified,
} = require("../lib/firebase");

const EVENT_INFO = {
  date: "09/05/2026",
  time: "16:00",
  church: {
    name: "Cerimônia Religiosa",
    address:
      "Praça Cel. Joaquim Estanislau de Arruda, 198 - Vila Mencacci, Sorocaba - SP, 18090-190",
    mapLink: "https://maps.app.goo.gl/5rLTV3ya9oQpxzju6",
  },
  party: {
    name: "Recepção e Festa",
    address: "R. Angelino Roque, 96, Sorocaba - SP, 18105-120",
    mapLink: "https://goo.gl/maps/2br7L2wLLQP2",
  },
};

const sendEmail = async (emailData) => {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    return response.ok;
  } catch (error) {
    console.error("Erro ao enviar email:", error.message);
    return false;
  }
};

const parseDate = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal.toDate === "function") return dateVal.toDate();
  return new Date(dateVal);
};

const runEmailJob = async (req, res) => {
  const jobToken = req.headers["x-job-key"];

  if (jobToken !== process.env.JOB_SECRET) {
    return res.status(403).json({ message: "Acesso negado: token inválido." });
  }

  try {
    const guests = await getApprovedPendingGuests();

    if (guests.length === 0) {
      return res.status(200).json({ message: "Nenhum convidado pendente." });
    }

    console.log(`[JOB] Verificando ${guests.length} convidados aprovados...`);

    const now = new Date();
    const results = [];
    const DELAY_MINUTES = 1440;

    for (const guest of guests) {
      if (guest.approvedAt) {
        const approvedTime = parseDate(guest.approvedAt);

        if (!approvedTime || isNaN(approvedTime.getTime())) {
          console.error(
            `[ERRO] Data inválida para ${guest.email}:`,
            guest.approvedAt
          );
          results.push({ email: guest.email, status: "erro_data_invalida" });
          continue;
        }

        const diffMinutes = (now - approvedTime) / 1000 / 60;

        if (diffMinutes < DELAY_MINUTES) {
          console.log(
            `⏳ ${guest.name}: Aguardando tempo (${Math.floor(
              diffMinutes
            )}/${DELAY_MINUTES} min)`
          );
          results.push({ email: guest.email, status: "aguardando_24h" });
          continue;
        }
      } else {
        continue;
      }

      // --- EMAIL ---
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .btn-map {
              display: inline-block;
              background-color: #d97706;
              color: #ffffff !important;
              text-decoration: none;
              padding: 10px 20px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: bold;
              text-align: center;
              border: 1px solid #b45309;
            }
            .card-location {
              background-color: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            }
            .highlight-date {
                background-color: #fffbeb;
                border: 1px dashed #d97706;
                border-radius: 8px;
                padding: 15px;
                margin: 25px 0;
                text-align: center;
            }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            
            <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
                
                <div style="padding: 40px 20px 20px 20px; text-align: center; background-color: #ffffff;">
                    <h1 style="color: #d97706; margin: 0; font-size: 32px; font-weight: normal; font-family: 'Times New Roman', serif;">Presença Confirmada! 🎉</h1>
                    <div style="width: 50px; height: 2px; background-color: #d97706; margin: 15px auto 0 auto;"></div>
                </div>

                <div style="padding: 20px 40px 40px 40px;">
                    <p style="color: #4b5563; font-size: 16px; text-align: center; margin-bottom: 10px; line-height: 1.6;">
                        Olá, <strong>${guest.name}</strong>!
                    </p>
                    <p style="color: #6b7280; font-size: 15px; text-align: center; margin-top: 0;">
                        Estamos contando os dias para celebrar com você.
                    </p>

                    <div class="highlight-date">
                        <p style="font-size: 22px; color: #92400e; font-weight: bold; margin: 0;">${EVENT_INFO.date}</p>
                        <p style="font-size: 16px; color: #b45309; margin: 5px 0 0 0;">às ${EVENT_INFO.time}</p>
                    </div>

                    <div class="card-location">
                        <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                            <div>
                                <h3 style="color: #92400e; margin-top: 0; margin-bottom: 5px; font-size: 18px;">💒 Cerimônia</h3>
                                <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 15px 0;">
                                    <strong>${EVENT_INFO.church.name}</strong><br>
                                    ${EVENT_INFO.church.address}
                                </p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                             <a href="${EVENT_INFO.church.mapLink}" class="btn-map">Ver no Mapa →</a>
                        </div>
                    </div>

                    <div class="card-location">
                         <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                            <div>
                                <h3 style="color: #92400e; margin-top: 0; margin-bottom: 5px; font-size: 18px;">🥂 Recepção</h3>
                                <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 15px 0;">
                                    <strong>${EVENT_INFO.party.name}</strong><br>
                                    ${EVENT_INFO.party.address}
                                </p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                             <a href="${EVENT_INFO.party.mapLink}" class="btn-map">Ver no Mapa →</a>
                        </div>
                    </div>

                    <div style="text-align: center; margin-top: 40px; border-top: 1px solid #f3f4f6; padding-top: 20px;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            Com carinho,<br>
                            <span style="color: #d97706; font-weight: bold;">Verônica & Vinicius</span>
                        </p>
                    </div>
                </div>
            </div>
            
            <div style="height: 40px;"></div>
        </body>
        </html>
      `;

      const sent = await sendEmail({
        sender: { name: "Casamento - V&V", email: process.env.EMAIL_SENDER },
        to: [{ email: guest.email, name: guest.name }],
        subject: "Sua presença foi confirmada! 💍",
        htmlContent: htmlContent,
      });

      if (sent) {
        await markGuestAsNotified(guest.id);
        results.push({ email: guest.email, status: "enviado" });
      } else {
        results.push({ email: guest.email, status: "erro_api_email" });
      }
    }

    return res.status(200).json({
      message: "Job concluído.",
      details: results,
    });
  } catch (error) {
    console.error("Erro no job:", error);
    return res.status(500).json({ message: "Erro interno." });
  }
};

module.exports = { runEmailJob };
