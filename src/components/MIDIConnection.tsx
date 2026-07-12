import React, { useEffect, useState } from 'react';
import { MidiDevice } from '../types';
import { Bluetooth, Radio, HelpCircle, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface MIDIConnectionProps {
  onMidiNoteOn: (midi: number, velocity: number) => void;
  onMidiNoteOff: (midi: number) => void;
  onMidiSustain?: (pressed: boolean) => void;
}

export default function MIDIConnection({ onMidiNoteOn, onMidiNoteOff, onMidiSustain }: MIDIConnectionProps) {
  const [midiSupported, setMidiSupported] = useState<boolean | null>(null);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);

  const isInsecureContext = typeof window !== 'undefined' && 
    window.location.protocol === 'http:' && 
    !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

  // Verificar suporte a Web MIDI API
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
      setMidiSupported(true);
      requestMIDI();
    } else {
      setMidiSupported(false);
    }
  }, []);

  // Solicitar acesso MIDI ao navegador
  const requestMIDI = async () => {
    setIsScanning(true);
    try {
      const access = await navigator.requestMIDIAccess({ sysex: true });
      setMidiAccess(access);
      updateDevices(access);

      // Escutar mudanças nas conexões de portas MIDI (ex: conectar/desconectar teclado)
      access.onstatechange = () => {
        updateDevices(access);
      };

      setErrorMsg('');
    } catch (err: any) {
      console.error('Acesso MIDI negado ou falhou', err);
      setErrorMsg('Não foi possível acessar seus dispositivos MIDI. Por favor, dê permissão no navegador.');
    } finally {
      setIsScanning(false);
    }
  };

  // Atualizar a lista de dispositivos MIDI conectados
  const updateDevices = (access: MIDIAccess) => {
    const inputs = Array.from(access.inputs.values());
    const mappedDevices: MidiDevice[] = inputs.map(input => ({
      id: input.id,
      name: input.name || 'Teclado MIDI Genérico',
      manufacturer: input.manufacturer || 'Desconhecido',
      state: input.state,
      connection: input.connection
    }));
    
    setDevices(mappedDevices);

    // Adicionar escutadores de mensagens MIDI para todos os inputs conectados
    inputs.forEach(input => {
      input.onmidimessage = handleMidiMessage;
    });
  };

  // Processar mensagens MIDI recebidas
  const handleMidiMessage = (event: any) => {
    const data = event.data;
    if (!data || data.length < 3) return;

    const command = data[0] & 0xf0;
    const channel = data[0] & 0x0f;
    const note = data[1];
    const velocity = data[2];

    // Command 144 (0x90) = Note On (Nota Pressionada)
    // Command 128 (0x80) = Note Off (Nota Solta)
    // Command 176 (0xB0) = Control Change (Pedal, botões, etc.)
    // Se note on com velocity 0, também é note off
    if (command === 144 && velocity > 0) {
      onMidiNoteOn(note, velocity);
    } else if (command === 128 || (command === 144 && velocity === 0)) {
      onMidiNoteOff(note);
    } else if (command === 176 && note === 64) {
      // Controle 64 é o Pedal de Sustain (Damper pedal)
      if (onMidiSustain) {
        onMidiSustain(velocity >= 64);
      }
    }
  };

  return (
    <div className="w-full bg-[#0D0D0D] border border-white/10 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center tracking-wider uppercase font-mono">
            <Radio className="w-4 h-4 text-[#00F0FF] mr-2 animate-pulse" />
            Conexão MIDI
          </h2>
          <p className="text-xs text-white/40 mt-1 font-mono">
            Teclados físicos via USB ou Bluetooth MIDI (BLE).
          </p>
        </div>

        <div className="flex items-center space-x-1.5 self-start sm:self-auto">
          {/* Botão Guia de Bluetooth */}
          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-mono uppercase bg-white/5 hover:bg-white/10 text-white border border-white/10 transition"
          >
            <Bluetooth className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>Bluetooth Guide</span>
            <HelpCircle className="w-3 h-3 text-white/55" />
          </button>

          {/* Botão de Atualizar */}
          <button
            onClick={requestMIDI}
            disabled={isScanning || midiSupported === false}
            className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30 transition"
            title="Escanear novos dispositivos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status da API MIDI */}
      <div className="mt-4">
        {midiSupported === false ? (
          <div className="flex items-start bg-amber-950/20 border border-amber-500/30 p-4 text-amber-200 text-xs leading-relaxed font-mono">
            <AlertTriangle className="w-4 h-4 mr-2.5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-100 uppercase tracking-wider">Web MIDI Não Disponível</p>
              {isInsecureContext ? (
                <div className="mt-1 text-white/70 space-y-2 leading-relaxed font-sans">
                  <p>
                    Você está acessando por um IP local (<b>{typeof window !== 'undefined' && window.location.hostname}</b>) via HTTP. 
                    Por motivos de segurança, os navegadores modernos (como o Google Chrome) <b>bloqueiam o acesso a instrumentos MIDI em conexões HTTP que não sejam localhost</b>.
                  </p>
                  <p className="text-amber-300 font-mono text-[11px] bg-amber-950/40 p-2.5 border border-amber-500/10 rounded">
                    <b>Como resolver no Google Chrome:</b>
                    <br />
                    1. Digite e acesse no Chrome: <span className="text-white bg-black/40 px-1 py-0.5 rounded font-mono select-all">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span>
                    <br />
                    2. <b>Ative (Enable)</b> a flag e adicione seu IP no campo de texto: <span className="text-white bg-black/40 px-1 py-0.5 rounded font-mono select-all">http://{typeof window !== 'undefined' && window.location.host}</span>
                    <br />
                    3. Clique em <b>Relaunch</b> no canto inferior direito para reiniciar o navegador.
                  </p>
                  <p className="text-white/40 text-[10px] leading-relaxed">
                    Alternativamente, acesse usando o endereço de visualização segura <b>HTTPS</b> do AI Studio ou rode como <b>http://localhost:3000</b> no seu VS Code local (localhost é sempre considerado seguro).
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-white/50 leading-relaxed font-sans">
                  Seu navegador atual não suporta conexão direta com instrumentos MIDI (comum no iOS Safari). 
                  Para usar um teclado físico, utilize o <b>Google Chrome no Android/Desktop</b> ou o <b>Opera/Edge</b>. 
                  <br />
                  <span className="text-[#00F0FF] font-medium font-mono uppercase tracking-wider text-[10px] block mt-1">Você ainda pode usar o Teclado Virtual interativo normalmente!</span>
                </p>
              )}
            </div>
          </div>
        ) : errorMsg ? (
          <div className="flex items-start bg-red-950/20 border border-red-500/30 p-4 text-red-300 text-xs font-mono">
            <AlertTriangle className="w-4 h-4 mr-2.5 shrink-0 text-red-400" />
            <div>
              <p className="font-semibold text-red-100 uppercase tracking-wider">Acesso MIDI Recusado</p>
              <p className="mt-1 text-white/50 leading-relaxed font-sans">{errorMsg}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Lista de dispositivos */}
            {devices.length === 0 ? (
              <div className="flex items-center justify-between bg-[#0A0A0A] border border-white/15 p-4">
                <span className="text-xs text-white/40 flex items-center font-mono">
                  <span className="w-2 h-2 rounded-full bg-white/20 mr-2.5 animate-ping" />
                  Nenhum dispositivo físico conectado. Aguardando notas MIDI...
                </span>
                <span className="text-[10px] font-mono text-white/30 uppercase bg-white/5 border border-white/10 px-2 py-0.5">
                  USB / Bluetooth
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono tracking-wider text-white/30 uppercase">
                  Dispositivos Ativos ({devices.length})
                </p>
                {devices.map((dev) => (
                  <div
                    key={dev.id}
                    className="flex items-center justify-between bg-[#0A0A0A] border border-[#00F0FF]/30 p-3.5 transition hover:border-[#00F0FF]/50"
                  >
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-4 h-4 text-[#00F0FF] shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-white">{dev.name}</p>
                        <p className="text-[10px] text-white/40 font-mono">Fabricante: {dev.manufacturer}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
                      <span className="text-[9px] font-mono text-[#00F0FF] uppercase font-semibold">
                        Conectado
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* GUIA DE CONEXÃO BLUETOOTH MIDI (Explicativo e visualmente impecável) */}
      {isGuideOpen && (
        <div className="mt-4 bg-[#0A0A0A] border border-white/10 p-5 text-xs text-white/70 animate-fadeIn font-mono">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h4 className="font-semibold text-white uppercase tracking-wider flex items-center">
              <Bluetooth className="w-4 h-4 mr-1.5 text-[#00F0FF]" />
              Pareamento BLE-MIDI (Bluetooth)
            </h4>
            <button
              onClick={() => setIsGuideOpen(false)}
              className="text-[10px] text-white/40 hover:text-white uppercase font-mono bg-white/5 border border-white/10 px-2 py-0.5"
            >
              Fechar
            </button>
          </div>
          
          <div className="mt-3 space-y-3 leading-relaxed">
            <p className="font-sans text-white/50 text-xs">
              Os teclados MIDI Bluetooth transmitem dados de baixa latência (BLE MIDI). Como o navegador roda em um ambiente de sandbox, você precisa parear o teclado com o <b>sistema operacional</b> primeiro:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="bg-[#111111] p-4 border border-white/5">
                <span className="text-[10px] font-mono text-[#00F0FF] uppercase font-bold tracking-wider"> macOS (Mac)</span>
                <ol className="list-decimal list-inside mt-2 text-white/50 font-sans text-xs space-y-1">
                  <li>Abra o aplicativo <b>Ajustes de Áudio e MIDI</b>.</li>
                  <li>No menu superior, escolha <b>Janela &gt; Mostrar Estúdio MIDI</b>.</li>
                  <li>Na barra de ferramentas, dê duplo clique em <b>Bluetooth</b>.</li>
                  <li>Ligue o teclado MIDI e clique em <b>Conectar</b>.</li>
                </ol>
              </div>

              <div className="bg-[#111111] p-4 border border-white/5">
                <span className="text-[10px] font-mono text-[#00F0FF] uppercase font-bold tracking-wider">🤖 Android (Chrome)</span>
                <ol className="list-decimal list-inside mt-2 text-white/50 font-sans text-xs space-y-1">
                  <li>Ative o Bluetooth do dispositivo Android.</li>
                  <li>Pareie o teclado musical nas Configurações Bluetooth.</li>
                  <li>Use o app gratuito <b>MIDI BLE Connect</b> na Google Play se o Chrome não detectar de imediato.</li>
                  <li>Retorne e atualize a página.</li>
                </ol>
              </div>

              <div className="bg-[#111111] p-4 border border-white/5">
                <span className="text-[10px] font-mono text-[#00F0FF] uppercase font-bold tracking-wider">❖ Windows 10/11</span>
                <ol className="list-decimal list-inside mt-2 text-white/50 font-sans text-xs space-y-1">
                  <li>Acesse <b>Configurações &gt; Bluetooth e Dispositivos</b>.</li>
                  <li>Clique em <b>Adicionar Dispositivo</b> &gt; Bluetooth.</li>
                  <li>Selecione seu teclado MIDI Bluetooth e conclua o pareamento.</li>
                  <li>Atualize o site e divirta-se.</li>
                </ol>
              </div>

              <div className="bg-[#111111] p-4 border border-white/5">
                <span className="text-[10px] font-mono text-[#00F0FF] uppercase font-bold tracking-wider">📱 iOS / iPadOS</span>
                <ol className="list-decimal list-inside mt-2 text-white/50 font-sans text-xs space-y-1">
                  <li>Use o app gratuito <b>WebBLE</b> ou <b>Wmidi</b> na App Store.</li>
                  <li>Eles servem como ponte BLE MIDI para carregar este site.</li>
                  <li>Abra o link do analisador por lá!</li>
                </ol>
              </div>
            </div>

            <p className="text-[10px] text-[#00F0FF]/80 uppercase tracking-widest mt-2">
              DICA: Conexões via cabo USB OTG funcionam instantaneamente sem pareamento!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
