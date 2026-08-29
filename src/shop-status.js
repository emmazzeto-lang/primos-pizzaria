/** Aberto ou fechado agora, com base no horário do aparelho. */
import { CONFIG } from "./config.js";

const NOMES_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * @returns {{ aberta: boolean, quando: string }}
 *   quando = "hoje às 19h" / "amanhã às 19h" / "sexta às 19h"
 */
export function lojaStatus(now = new Date()) {
  const dia = now.getDay();
  const hora = now.getHours() + now.getMinutes() / 60;
  const aberta =
    CONFIG.diasAbre.includes(dia) && hora >= CONFIG.abreHora && hora < CONFIG.fechaHora;

  let proxima = null;
  for (let i = 0; i < 8; i++) {
    const c = new Date(now);
    c.setDate(now.getDate() + i);
    c.setHours(CONFIG.abreHora, 0, 0, 0);
    if (c > now && CONFIG.diasAbre.includes(c.getDay())) {
      proxima = c;
      break;
    }
  }

  let quando = "";
  if (proxima) {
    const dias = Math.round(
      (new Date(proxima).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000
    );
    quando =
      dias === 0
        ? `hoje às ${CONFIG.abreHora}h`
        : dias === 1
          ? `amanhã às ${CONFIG.abreHora}h`
          : `${NOMES_DIA[proxima.getDay()]} às ${CONFIG.abreHora}h`;
  }

  return { aberta, quando };
}
