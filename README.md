![Logo](admin/falmec.png)

# ioBroker.falmec

[Deutsch](#deutsch) | [English](#english)

> **Status / Stand:** Generated signals confirmed on the real hood; the adapter has not yet run on a live system. / Erzeugte Signale an der echten Haube bestätigt; der Adapter lief noch nicht auf einem echten System.

## Deutsch

Steuert eine Falmec-Vega-Deckenhaube (Funk 434 MHz) über einen BroadLink RM4 Pro und den Adapter `broadlink2`.

Dieses Projekt ist privat und steht in keiner Verbindung zu Falmec oder BroadLink.

### Datenpunkte

| Datenpunkt | Bedeutung |
|---|---|
| `light.on` | Licht an/aus |
| `light.toggle` | Licht umschalten |
| `fan.level` | Lüfterstufe 0–4, 0 = aus |
| `fan.up` / `fan.down` | Eine Stufe hoch/runter |
| `timer.minutes` | Timer-Dauer, 1–240 Minuten |
| `timer.start` / `timer.stop` | Timer starten/abbrechen; Abbrechen ändert den Lüfter nicht |
| `timer.active` / `timer.remaining` / `timer.end` / `timer.total` | Timer läuft, Restzeit in Minuten, Endzeit, Gesamtdauer in Minuten |
| `preset.level` / `preset.light` / `preset.timer` | Voreinstellung: Stufe, Licht, Timer in Minuten (0 = ohne). „Alles aus“ ist nicht möglich; soll die Stufe auf 0, zuerst das Licht einschalten. Ein Timer gilt nur bei laufendem Lüfter |
| `preset.toggle` | Ist alles aus, startet die Voreinstellung; sonst geht alles aus und ein laufender Timer endet. Ein zweiter Druck innerhalb von 1 s wird ignoriert |
| `info.connection` | broadlink2 läuft und das Gerät ist erreichbar |

### Einschränkungen

Die Haube meldet nichts zurück. Der Adapter zeigt deshalb nur den zuletzt von ihm gesendeten Stand. Nach Benutzung der Fernbedienung oder einem Stromausfall stimmt die Anzeige erst nach dem nächsten Befehl wieder.

Jedes Signal setzt immer Lüfter und Licht zusammen. Ein Licht-Befehl kann den Lüfter also auf den zuletzt gesendeten Stand zurücksetzen, wenn er inzwischen per Fernbedienung geändert wurde.

Ungültige Werte und Befehle, die nicht gesendet werden konnten, werden verworfen: Der Datenpunkt zeigt danach wieder den zuletzt gesendeten Stand, im Log steht eine Warnung.

Ein Befehl, den der Adapter nicht mehr verarbeitet (er läuft nicht oder wird gerade beendet), wird beim nächsten Start verworfen. Der Datenpunkt zeigt dann Stufe 0 bzw. Licht aus, bis zum nächsten Befehl.

### Konfiguration

- **broadlink2-Instanz** und **Gerätename**: Das Gerät, das die Signale sendet (Name beginnt mit `RM:`).
- **Grundmuster**: Festes 16-Bit-Signal der eigenen Haube, mit allen Stufen- und Licht-Bits auf 0. Es bleibt in der Instanz-Konfiguration und gehört nicht ins Repository.

## English

Controls a Falmec Vega ceiling hood (RF 434 MHz) through a BroadLink RM4 Pro and the `broadlink2` adapter.

This is a private project and is not affiliated with Falmec or BroadLink.

### States

| State | Meaning |
|---|---|
| `light.on` | Light on/off |
| `light.toggle` | Toggle the light |
| `fan.level` | Fan level 0–4, 0 = off |
| `fan.up` / `fan.down` | One level up/down |
| `timer.minutes` | Timer duration, 1–240 minutes |
| `timer.start` / `timer.stop` | Start/cancel the timer; cancelling leaves the fan unchanged |
| `timer.active` / `timer.remaining` / `timer.end` / `timer.total` | Timer running, remaining minutes, end time, full duration in minutes |
| `preset.level` / `preset.light` / `preset.timer` | Preset: level, light, timer in minutes (0 = none). "Everything off" is not possible; to set the level to 0, switch the light on first. A timer only applies while the fan runs |
| `preset.toggle` | Starts the preset if everything is off; otherwise switches everything off and ends a running timer. A second press within 1 s is ignored |
| `info.connection` | broadlink2 is running and the device is reachable |

### Limitations

The hood sends no feedback. The adapter therefore only shows the state it last sent. After the original remote has been used or after a power failure, the display is correct again after the next command.

Every signal always sets fan and light together. A light command can therefore reset the fan to the last sent state if it was changed with the remote in the meantime.

Invalid values and commands that could not be sent are discarded: The state shows the last sent value again and a warning appears in the log.

A command the adapter no longer processes (it is not running or is just stopping) is discarded at the next start. The state then shows level 0 or light off until the next command.

### Configuration

- **broadlink2 instance** and **device name**: The device that sends the signals (the name starts with `RM:`).
- **Base pattern**: Fixed 16-bit signal of your own hood, with all level and light bits set to 0. It stays in the instance configuration and does not belong in the repository.

## Changelog

### 0.0.1

- (Sven-83) initial skeleton

## License

MIT License

Copyright (c) 2026 Sven-83 <276080681+Sven-83@users.noreply.github.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
