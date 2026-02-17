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
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            
            <div style="background-color: #fff8f0; padding: 30px 20px; text-align: center; border-bottom: 3px solid #d97706;">
                <h2 style="color: #d97706; margin: 0; font-size: 24px;">Presença Confirmada! 🎉</h2>
                <p style="color: #78350f; margin-top: 10px; font-size: 16px;">Estamos muito felizes em ter você conosco!</p>
            </div>

            <div style="padding: 30px 25px;">
                <p style="font-size: 16px; margin-bottom: 25px;">Olá, <strong>${guest.name}</strong>!</p>
                <p style="margin-bottom: 25px; line-height: 1.5;">Sua presença foi confirmada com sucesso. Abaixo estão todos os detalhes para o grande dia:</p>
                
                <div style="text-align: center; margin-bottom: 30px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
                    <p style="margin: 5px 0; font-size: 18px;"><strong>📅 ${EVENT_INFO.date}</strong></p>
                    <p style="margin: 5px 0; font-size: 18px;"><strong>⏰ às ${EVENT_INFO.time}</strong></p>
                </div>

                <div style="margin-bottom: 25px; border-left: 4px solid #d97706; padding-left: 15px;">
                    <h3 style="margin: 0 0 5px 0; color: #d97706;">💒 ${EVENT_INFO.church.name}</h3>
                    <p style="margin: 0 0 10px 0; color: #555; font-size: 14px;">${EVENT_INFO.church.address}</p>
                    <a href="${EVENT_INFO.church.mapLink}" style="display: inline-block; text-decoration: none; color: #0369a1; font-weight: bold; font-size: 14px;">📍 Ver Igreja no Mapa &rarr;</a>
                </div>

                <div style="margin-bottom: 25px; border-left: 4px solid #d97706; padding-left: 15px;">
                    <h3 style="margin: 0 0 5px 0; color: #d97706;">🥂 ${EVENT_INFO.party.name}</h3>
                    <p style="margin: 0 0 10px 0; color: #555; font-size: 14px;">${EVENT_INFO.party.address}</p>
                    <a href="${EVENT_INFO.party.mapLink}" style="display: inline-block; text-decoration: none; color: #0369a1; font-weight: bold; font-size: 14px;">📍 Ver Festa no Mapa &rarr;</a>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="text-align: center; color: #999; font-size: 12px;">
                   Dúvidas? Entre em contato pelo nosso site.<br>
                   Esperamos você lá! ❤️
                </p>
            </div>
        </div>
      `;

      const sent = await sendEmail({
        sender: { name: "Casamento Veronica", email: process.env.EMAIL_SENDER },
        to: [{ email: guest.email, name: guest.name }],
        subject: "Sua presença foi confirmada! Veja os endereços.",
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
