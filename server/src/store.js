import fs from 'node:fs';
import path from 'node:path';

const VAZIO = {
  grupo: { nome: 'saBORR futebol', chavePix: '' },
  atletas: [],
  eventos: [],
};

/**
 * Armazenamento em um único arquivo JSON.
 * - Os dados ficam em memória; cada alteração regrava o arquivo (escrita atômica:
 *   grava em arquivo temporário e renomeia).
 * - Uma cópia de segurança por dia é guardada em <pasta>/backups (últimas 30).
 */
export class Store {
  constructor(file) {
    this.file = file;
    this.dir = path.dirname(file);
    this.data = null;
    this._fila = Promise.resolve();
  }

  load() {
    fs.mkdirSync(this.dir, { recursive: true });
    if (!fs.existsSync(this.file)) {
      this.data = structuredClone(VAZIO);
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2) + '\n');
    } else {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    }
    this.data.grupo ??= structuredClone(VAZIO.grupo);
    this.data.atletas ??= [];
    this.data.eventos ??= [];
    return this;
  }

  /** Grava o estado atual. Chamadas simultâneas são enfileiradas. */
  save() {
    this._fila = this._fila.then(() => this._gravar());
    return this._fila;
  }

  _gravar() {
    this._backupDoDia();
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n');
    fs.renameSync(tmp, this.file);
  }

  _backupDoDia() {
    try {
      if (!fs.existsSync(this.file)) return;
      const pasta = path.join(this.dir, 'backups');
      fs.mkdirSync(pasta, { recursive: true });
      const hoje = new Date().toISOString().slice(0, 10);
      const destino = path.join(pasta, `db-${hoje}.json`);
      if (!fs.existsSync(destino)) {
        fs.copyFileSync(this.file, destino);
        const antigos = fs.readdirSync(pasta).filter((f) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
        for (const f of antigos.slice(0, Math.max(0, antigos.length - 30))) {
          fs.unlinkSync(path.join(pasta, f));
        }
      }
    } catch (err) {
      console.error('Falha ao criar backup diário:', err.message);
    }
  }
}
