import type { ReactElement } from "react";
import { ActivityLegend } from "../components/ActivityLegend";
import { type Dictionary, defineText } from "../i18n/locale";

export interface GuideChapter {
    title: string;
    body: ReactElement;
}

/** Both languages must have the same chapters in the same order. */
export const GUIDE: Dictionary<GuideChapter[]> = defineText<GuideChapter[]>([
    {
        title: "Erste Schritte",
        body: <>
            <h4>In 5 Schritten zum Netzplan</h4>
            <ol>
                <li>Links bei <b>Diagrammart</b> „Netzplan“ wählen, dann auf <b>Vorgang</b> klicken (Taste <kbd>1</kbd>) und auf die Zeichenfläche klicken. Ein Vorgangsknoten erscheint. Mit gedrückter <kbd>Umschalt</kbd>-Taste setzt du mehrere hintereinander.</li>
                <li>Den Knoten doppelt anklicken und Nr., Bezeichnung und Dauer eintragen. Mit <kbd>Tab</kbd> springst du ins nächste Feld, mit <kbd>Enter</kbd> bist du fertig.</li>
                <li>Weitere Vorgänge genauso anlegen.</li>
                <li>Mit dem <b>Pfeil</b> (Taste <kbd>A</kbd>) zuerst den Vorgänger, dann den Nachfolger anklicken.</li>
                <li>Selbst rechnen und auf <b>Prüfen</b> klicken, oder mit <b>Berechnen</b> alles ausfüllen lassen.</li>
            </ol>
            <div className="tip">Schneller geht&apos;s über <b>Vorgangsliste</b>: Liste eintippen, und der Netzplan wird fertig gezeichnet.</div>
        </>,
    },
    {
        title: "Vorgänge & Texte",
        body: <>
            <h4>Vorgänge, Formen und Texte</h4>
            <p>Ein Vorgangsknoten ist so aufgebaut wie in der Prüfung:</p>
            <ActivityLegend maxWidth={320} />
            <ul>
                <li><b>Bearbeiten geht immer:</b> Doppelklick auf ein Feld, oder Knoten anklicken und rechts im Bereich „Eigenschaften“ ändern.</li>
                <li><b>Verschieben:</b> Knoten ziehen. Er rastet im Raster ein. Mit den Pfeiltasten verschiebst du ihn feiner.</li>
                <li><b>Größe ändern:</b> am blauen Quadrat unten rechts ziehen.</li>
                <li><b>Farbe:</b> rechts eine Füllfarbe wählen.</li>
                <li><b>Rechteck, Ellipse, Raute, Text</b> für Notizen, Legenden oder Überschriften. Doppelklick auf eine leere Stelle legt direkt ein Textfeld an.</li>
                <li><b>Löschen</b> mit <kbd>Entf</kbd>, <b>Duplizieren</b> mit <kbd>Strg+D</kbd>.</li>
            </ul>
        </>,
    },
    {
        title: "Pfeile",
        body: <>
            <h4>Pfeile setzen</h4>
            <ol>
                <li>Pfeil-Werkzeug wählen (Taste <kbd>A</kbd>).</li>
                <li>Vorgänger anklicken, dann Nachfolger anklicken. Oder vom Vorgänger zum Nachfolger ziehen.</li>
                <li>Das Werkzeug bleibt aktiv, du kannst gleich weitere Pfeile setzen. <kbd>Esc</kbd> beendet es.</li>
            </ol>
            <ul>
                <li>Pfeile laufen automatisch mit, wenn du Knoten verschiebst.</li>
                <li>Gehen mehrere Vorgänge auf dieselben Nachfolger, werden die Pfeile über eine gemeinsame Linie zusammengeführt.</li>
                <li>Pfeil anklicken: Richtung umdrehen, beschriften oder löschen.</li>
            </ul>
        </>,
    },
    {
        title: "Rechnen & Prüfen",
        body: <>
            <h4>Rechnen und Prüfen</h4>
            <ul>
                <li><b>Berechnen</b> füllt FAZ, FEZ, SAZ, SEZ, GP und FP aus. Der kritische Pfad (GP = 0) wird rot.</li>
                <li><b>Prüfen</b> vergleicht deine eingetragenen Werte mit der Lösung. Falsche Felder werden rot hinterlegt, rechts steht der Fehler mit der passenden Formel.</li>
                <li>Ein Klick auf einen Fehler springt zum Vorgang. Mit „Richtige Werte anzeigen“ siehst du die Lösung.</li>
                <li>Geprüft wird auch der Aufbau: Kreise, fehlende Dauer, doppelte Nummern, Vorgänge ohne Pfeil, mehrere Start- oder Endvorgänge, überflüssige Pfeile.</li>
            </ul>
            <p><b>Zählweise</b> (rechts im Bereich „Eigenschaften“):</p>
            <ul>
                <li><b>Start bei 0:</b> FEZ = FAZ + D, Nachfolger FAZ = größter FEZ.</li>
                <li><b>Start bei 1:</b> FEZ = FAZ + D − 1, Nachfolger FAZ = größter FEZ + 1.</li>
            </ul>
            <div className="tip">Nimm die Zählweise, die ihr in der Schule verwendet. Passen deine Werte zur anderen Zählweise, sagt dir „Prüfen“ das.</div>
        </>,
    },
    {
        title: "Extras",
        body: <>
            <h4>Extras</h4>
            <ul>
                <li><b>Sauber anordnen</b> (Taste <kbd>L</kbd>) räumt alles auf: Netzplan in Spalten, Aktivität und Zustand von oben nach unten mit sauberen Balken und Partitionen, Use-Case mit Akteuren außen, Klassen nach Vererbung geschichtet, Sequenz mit gleichmäßigen Nachrichtenabständen. Mit <kbd>Strg+Z</kbd> geht&apos;s zurück.</li>
                <li><b>Gantt</b> zeigt den Zeitplan als Balkendiagramm. Rot sind kritische Vorgänge, schraffiert ist der Gesamtpuffer.</li>
                <li><b>Vorgangsliste:</b> eine Zeile pro Vorgang im Format <code>Nr; Bezeichnung; Dauer; Vorgänger</code>, mehrere Vorgänger mit Komma. Eine Tabelle aus Excel kannst du direkt einfügen.</li>
                <li><b>Übung</b> erzeugt eine Zufallsaufgabe. „Rechnen“: Plan ist gezeichnet, du füllst die Werte aus. „Zeichnen und rechnen“: du bekommst nur die Vorgangsliste und setzt die Pfeile selbst.</li>
            </ul>
        </>,
    },
    {
        title: "UML-Diagramme",
        body: <>
            <h4>UML-Diagramme zeichnen</h4>
            <p>Links oben wählst du die <b>Diagrammart</b>: Netzplan, Aktivität, Use-Case, Klassen, Sequenz, Zustand, Objekt, Komponente, Verteilung, Paket oder freies Zeichnen. Darunter siehst du nur die Elemente und Verbindungen, die du dafür brauchst, und meist ein <b>Beispiel</b> zum Einfügen. Die Ziffern <kbd>1</kbd>–<kbd>9</kbd> wählen ein Element direkt. Weitere Formen liegen unter „Allgemeine Formen“.</p>
            <p><b>Aktivitätsdiagramm in wenigen Klicks:</b></p>
            <ol>
                <li>Startknoten setzen.</li>
                <li>Startknoten anklicken und rechts unter <b>Danach anhängen</b> eine Aktion wählen. Sie wird darunter gesetzt, verbunden und du kannst direkt den Text tippen.</li>
                <li>Für Verzweigungen eine <b>Entscheidung</b> anhängen und dann zweimal <b>Zweig hinzufügen</b>. Die Pfeile bekommen [ja] und [nein], per Doppelklick änderst du die Bedingung.</li>
                <li>Für parallele Abläufe eine <b>Gabelung</b> anhängen, die Zweige wieder in einen Balken (Vereinigung) führen, am Ende den <b>Endknoten</b>.</li>
            </ol>
            <ul>
                <li>Pfeile laufen rechtwinklig. Ein Pfeil zurück nach oben (Schleife) läuft links außen herum.</li>
                <li><b>Verbindungen:</b> links unter „Verbindungen“ oder oben links auf der Fläche wählst du die Art, z. B. Vererbung, Komposition oder «include». „Automatisch“ nimmt die passende.</li>
                <li><b>Klassen:</b> Doppelklick in Name, Attribute oder Methoden. Mit <kbd>Enter</kbd> neue Zeile, mit <kbd>Strg+Enter</kbd> fertig.</li>
                <li><b>Sequenz:</b> Nachrichten zwischen Lebenslinien setzen, dann nach oben oder unten ziehen.</li>
                <li><b>Prüfen</b> kontrolliert auch UML: fehlender Start- oder Endknoten, Entscheidung ohne Bedingungen, falsche Balken, Use-Case ohne Akteur, Sichtbarkeit und Datentypen in Klassen und mehr.</li>
            </ul>
        </>,
    },
    {
        title: "Speichern & Teilen",
        body: <>
            <h4>Speichern, Bild und Teilen</h4>
            <ul>
                <li>Dein Plan wird <b>automatisch</b> in diesem Browser gespeichert und ist beim nächsten Öffnen wieder da.</li>
                <li><b>Bild</b> zeigt eine Vorschau. Du kannst sie als PNG speichern oder kopieren und mit <kbd>Strg+V</kbd> in Word oder PowerPoint einfügen.</li>
                <li><b>Speichern</b> (<kbd>Strg+S</kbd>) speichert den Plan unter einem Namen hier im Browser. Oben neben dem Logo siehst du den Namen. Ein Punkt dahinter heißt: es gibt ungespeicherte Änderungen.</li>
                <li><b>Öffnen</b> (<kbd>Strg+O</kbd>) zeigt <b>Meine Pläne</b>: öffnen, umbenennen, löschen. Dort kannst du Pläne auch als Datei exportieren oder importieren, z. B. für ein anderes Gerät. Dateien kannst du auch einfach auf die Zeichenfläche ziehen.</li>
                <li><b>Neu</b> leert die Fläche. Mit <kbd>Strg+Z</kbd> holst du alles zurück.</li>
            </ul>
            <p><b>Sprache und Design:</b> Ganz rechts in der oberen Leiste wechselst du mit <b>DE/EN</b> zwischen Deutsch und Englisch. Der Button daneben stellt das Design um (wie das System, hell oder dunkel). Beides merkt sich der Browser.</p>
            <div className="tip">Wer den Link hat, bekommt neue Versionen der App automatisch, einfach die Seite neu laden. Gezeichnete Pläne bleiben dabei erhalten.</div>
        </>,
    },
    {
        title: "Subnetting",
        body: <>
            <h4>Subnetting rechnen und üben</h4>
            <p>Oben neben dem Logo schaltest du zwischen <b>Zeichnen</b> und <b>Subnetting</b> um. Der Browser merkt sich, wo du zuletzt warst.</p>
            <ul>
                <li><b>Rechner:</b> Adresse mit Präfix eintippen, z. B. <code>192.168.1.10/26</code>, oder Adresse und Maske. Du siehst sofort Netzadresse, Broadcast, Hostbereich, Anzahl Hosts, Maske, Wildcard, Klasse und ob die Adresse privat ist. Die Binäransicht zeigt Netz- und Hostanteil.</li>
                <li><b>Subnetze aufteilen:</b> ein Netz in gleich große Subnetze teilen, oder mit <b>VLSM</b> nach Hostbedarf. Die größte Abteilung bekommt zuerst ein Netz.</li>
                <li><b>IPv6:</b> Adressen nach RFC 5952 kürzen und ausschreiben, Netzpräfix und Anzahl der /64-Subnetze.</li>
                <li><b>Üben:</b> Zufallsaufgaben wie in der Prüfung. <b>Prüfen</b> markiert jedes Feld und gibt einen Tipp, <b>Lösung zeigen</b> verrät alles. Richtig gelöste Aufgaben zählen für die Serie und für Erfolge.</li>
            </ul>
            <div className="tip">/31 und /32 sind Sonderfälle: /31 ist nach RFC 3021 eine Punkt-zu-Punkt-Verbindung mit 2 nutzbaren Adressen, /32 genau ein Host. In der Prüfung gilt meist 2^n − 2.</div>
        </>,
    },
    {
        title: "Tastenkürzel",
        body: <>
            <h4>Tastenkürzel</h4>
            <div className="keys">
                <kbd>V</kbd><span>Auswahl</span>
                <kbd>A</kbd><span>Pfeil</span>
                <kbd>1 – 9</kbd><span>Element aus der linken Leiste</span>
                <kbd>L</kbd><span>Sauber anordnen</span>
                <kbd>Umschalt + Klick</kbd><span>mehrere Elemente nacheinander setzen</span>
                <kbd>N / R / E / D / T</kbd><span>Vorgang / Rechteck / Ellipse / Raute / Text</span>
                <kbd>Doppelklick</kbd><span>Feld oder Text bearbeiten</span>
                <kbd>Enter</kbd><span>ausgewählten Knoten bearbeiten / Eingabe beenden</span>
                <kbd>Tab</kbd><span>nächstes Feld im Knoten</span>
                <kbd>Esc</kbd><span>abbrechen, Werkzeug beenden</span>
                <kbd>Entf</kbd><span>Auswahl löschen</span>
                <kbd>Pfeiltasten</kbd><span>Knoten verschieben (mit Umschalt weiter)</span>
                <kbd>Strg+C / V</kbd><span>Kopieren / Einfügen</span>
                <kbd>Strg+D</kbd><span>Duplizieren</span>
                <kbd>Strg+Z / Y</kbd><span>Rückgängig / Wiederholen</span>
                <kbd>Strg+S / O</kbd><span>Speichern / Meine Pläne</span>
                <kbd>Mausrad</kbd><span>Zoomen</span>
                <kbd>Leertaste + Ziehen</kbd><span>Fläche verschieben (oder leere Fläche ziehen)</span>
            </div>
        </>,
    },
], [
    {
        title: "Getting started",
        body: <>
            <h4>A network diagram in 5 steps</h4>
            <ol>
                <li>On the left under <b>Diagram type</b> choose “Network diagram”, then click <b>Activity</b> (key <kbd>1</kbd>) and click on the canvas. An activity node appears. Hold <kbd>Shift</kbd> to place several in a row.</li>
                <li>Double-click the node and enter No., name and duration. <kbd>Tab</kbd> jumps to the next field, <kbd>Enter</kbd> finishes.</li>
                <li>Add more activities the same way.</li>
                <li>With the <b>Arrow</b> (key <kbd>A</kbd>) click the predecessor first, then the successor.</li>
                <li>Do the calculation yourself and click <b>Check</b>, or let <b>Calculate</b> fill in everything.</li>
            </ol>
            <div className="tip">It&apos;s quicker with the <b>Activity list</b>: type the list and the network diagram is drawn for you.</div>
        </>,
    },
    {
        title: "Activities & text",
        body: <>
            <h4>Activities, shapes and text</h4>
            <p>An activity node is laid out like in the exam:</p>
            <ActivityLegend maxWidth={320} />
            <ul>
                <li><b>You can always edit:</b> double-click a field, or click the node and change it on the right under “Properties”.</li>
                <li><b>Move:</b> drag the node. It snaps to the grid. The arrow keys move it in finer steps.</li>
                <li><b>Resize:</b> drag the blue square at the bottom right.</li>
                <li><b>Colour:</b> choose a fill colour on the right.</li>
                <li><b>Rectangle, ellipse, diamond, text</b> for notes, legends or headings. Double-clicking an empty spot creates a text field right away.</li>
                <li><b>Delete</b> with <kbd>Del</kbd>, <b>duplicate</b> with <kbd>Ctrl+D</kbd>.</li>
            </ul>
        </>,
    },
    {
        title: "Arrows",
        body: <>
            <h4>Drawing arrows</h4>
            <ol>
                <li>Choose the arrow tool (key <kbd>A</kbd>).</li>
                <li>Click the predecessor, then click the successor. Or drag from the predecessor to the successor.</li>
                <li>The tool stays active, so you can draw more arrows straight away. <kbd>Esc</kbd> ends it.</li>
            </ol>
            <ul>
                <li>Arrows follow automatically when you move nodes.</li>
                <li>If several activities lead to the same successors, their arrows are merged into a shared line.</li>
                <li>Click an arrow to reverse it, label it or delete it.</li>
            </ul>
        </>,
    },
    {
        title: "Calculate & check",
        body: <>
            <h4>Calculating and checking</h4>
            <ul>
                <li><b>Calculate</b> fills in ES, EF, LS, LF, TF and FF. The critical path (TF = 0) turns red.</li>
                <li><b>Check</b> compares the values you entered with the solution. Wrong fields are highlighted in red, and on the right you see the error with the matching formula.</li>
                <li>Clicking an error jumps to the activity. “Show correct values” shows you the solution.</li>
                <li>The structure is checked too: cycles, missing durations, duplicate numbers, activities without arrows, several start or end activities, redundant arrows.</li>
            </ul>
            <p><b>Counting mode</b> (on the right under “Properties”):</p>
            <ul>
                <li><b>Start at 0:</b> EF = ES + D, successor ES = largest EF.</li>
                <li><b>Start at 1:</b> EF = ES + D − 1, successor ES = largest EF + 1.</li>
            </ul>
            <div className="tip">Use the counting mode you use at school. If your values match the other counting mode, “Check” tells you.</div>
        </>,
    },
    {
        title: "Extras",
        body: <>
            <h4>Extras</h4>
            <ul>
                <li><b>Tidy up</b> (key <kbd>L</kbd>) arranges everything: network diagram in columns, activity and state machine diagrams top to bottom with neat bars and partitions, use cases with actors outside, classes layered by inheritance, sequences with even spacing between messages. <kbd>Ctrl+Z</kbd> takes it back.</li>
                <li><b>Gantt</b> shows the schedule as a bar chart. Critical activities are red, total float is hatched.</li>
                <li><b>Activity list:</b> one line per activity in the format <code>No; Name; Duration; Predecessors</code>, several predecessors separated by commas. You can paste a table from Excel directly.</li>
                <li><b>Exercise</b> creates a random task. “Calculate”: the diagram is drawn, you fill in the values. “Draw and calculate”: you only get the activity list and draw the arrows yourself.</li>
            </ul>
        </>,
    },
    {
        title: "UML diagrams",
        body: <>
            <h4>Drawing UML diagrams</h4>
            <p>At the top left you choose the <b>Diagram type</b>: network diagram, activity, use case, class, sequence, state machine, object, component, deployment, package or free drawing. Below it you only see the elements and connections you need for it, and usually an <b>example</b> to insert. The digits <kbd>1</kbd>–<kbd>9</kbd> pick an element directly. More shapes are under “General shapes”.</p>
            <p><b>An activity diagram in a few clicks:</b></p>
            <ol>
                <li>Place an initial node.</li>
                <li>Click the initial node and choose an action on the right under <b>Append next</b>. It is placed below, connected, and you can type its text right away.</li>
                <li>For branches append a <b>Decision</b> and then click <b>Add branch</b> twice. The arrows get [yes] and [no], double-click to change the condition.</li>
                <li>For parallel flows append a <b>Fork</b>, lead the branches back into a bar (join), and finish with the <b>Final node</b>.</li>
            </ol>
            <ul>
                <li>Arrows run at right angles. An arrow back up (loop) goes around on the left.</li>
                <li><b>Connections:</b> choose the kind on the left under “Connections” or at the top left of the canvas, e.g. inheritance, composition or «include». “Automatic” picks the right one.</li>
                <li><b>Classes:</b> double-click the name, attributes or operations. <kbd>Enter</kbd> starts a new line, <kbd>Ctrl+Enter</kbd> finishes.</li>
                <li><b>Sequence:</b> draw messages between lifelines, then drag them up or down.</li>
                <li><b>Check</b> also checks UML: missing initial or final node, decisions without conditions, wrong bars, use cases without an actor, visibility and data types in classes, and more.</li>
            </ul>
        </>,
    },
    {
        title: "Save & share",
        body: <>
            <h4>Saving, images and sharing</h4>
            <ul>
                <li>Your plan is saved <b>automatically</b> in this browser and is back the next time you open the app.</li>
                <li><b>Image</b> shows a preview. You can save it as PNG or copy it and paste it into Word or PowerPoint with <kbd>Ctrl+V</kbd>.</li>
                <li><b>Save</b> (<kbd>Ctrl+S</kbd>) saves the plan under a name here in the browser. You see the name at the top next to the logo. A dot after it means there are unsaved changes.</li>
                <li><b>Open</b> (<kbd>Ctrl+O</kbd>) shows <b>My plans</b>: open, rename, delete. There you can also export plans as a file or import them, e.g. for another device. You can also simply drop files onto the canvas.</li>
                <li><b>New</b> clears the canvas. <kbd>Ctrl+Z</kbd> brings everything back.</li>
            </ul>
            <p><b>Language and theme:</b> at the right end of the top bar, <b>DE/EN</b> switches between German and English. The button next to it changes the theme (follow the system, light or dark). The browser remembers both.</p>
            <div className="tip">Anyone with the link gets new versions of the app automatically, just reload the page. Your drawn plans are kept.</div>
        </>,
    },
    {
        title: "Subnetting",
        body: <>
            <h4>Calculate and practise subnetting</h4>
            <p>Next to the logo at the top you switch between <b>Draw</b> and <b>Subnetting</b>. The browser remembers where you were last.</p>
            <ul>
                <li><b>Calculator:</b> type an address with prefix, e.g. <code>192.168.1.10/26</code>, or an address and a mask. You see the network address, broadcast, host range, number of hosts, mask, wildcard, class and whether the address is private at once. The binary view shows the network and host part.</li>
                <li><b>Split network:</b> split a network into equal subnets, or by host demand with <b>VLSM</b>. The largest department gets its network first.</li>
                <li><b>IPv6:</b> shorten and expand addresses according to RFC 5952, network prefix and number of /64 subnets.</li>
                <li><b>Practice:</b> random exam style tasks. <b>Check</b> marks every field and gives a tip, <b>Show solution</b> reveals everything. Correctly solved tasks count for the streak and for achievements.</li>
            </ul>
            <div className="tip">/31 and /32 are special: /31 is a point-to-point link with 2 usable addresses (RFC 3021), /32 exactly one host. Exams usually apply 2^n − 2.</div>
        </>,
    },
    {
        title: "Keyboard shortcuts",
        body: <>
            <h4>Keyboard shortcuts</h4>
            <div className="keys">
                <kbd>V</kbd><span>Select</span>
                <kbd>A</kbd><span>Arrow</span>
                <kbd>1 – 9</kbd><span>Element from the left sidebar</span>
                <kbd>L</kbd><span>Tidy up</span>
                <kbd>Shift + click</kbd><span>place several elements in a row</span>
                <kbd>N / R / E / D / T</kbd><span>Activity / rectangle / ellipse / diamond / text</span>
                <kbd>Double-click</kbd><span>edit field or text</span>
                <kbd>Enter</kbd><span>edit selected node / finish input</span>
                <kbd>Tab</kbd><span>next field in the node</span>
                <kbd>Esc</kbd><span>cancel, end tool</span>
                <kbd>Del</kbd><span>delete selection</span>
                <kbd>Arrow keys</kbd><span>move nodes (further with Shift)</span>
                <kbd>Ctrl+C / V</kbd><span>Copy / paste</span>
                <kbd>Ctrl+D</kbd><span>Duplicate</span>
                <kbd>Ctrl+Z / Y</kbd><span>Undo / redo</span>
                <kbd>Ctrl+S / O</kbd><span>Save / my plans</span>
                <kbd>Mouse wheel</kbd><span>Zoom</span>
                <kbd>Space + drag</kbd><span>pan the canvas (or drag an empty area)</span>
            </div>
        </>,
    },
]);
