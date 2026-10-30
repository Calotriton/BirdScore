// The site's and the plot's texts. English is the source, written in index.html and app.js; Spanish is here.
const I18n = (() => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  let lang = (() => {
    try { const saved = localStorage.getItem('birdscore.lang'); if (saved) return saved; } catch { /* storage blocked */ }
    return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  })();

  const ES = {
    // The page
    'From confidence score to true positive rate': 'De la puntuación de confianza a la tasa de verdaderos positivos',
    'Your detections': 'Tus detecciones',
    'Start over': 'Empezar de nuevo',
    'Give BirdScore the detections you checked, sorted into positive (the identification was right) and negative (it was wrong).':
      'Da a BirdScore las detecciones que has revisado, separadas en positivas (la identificación era correcta) y negativas (era errónea).',
    'Where your detections are': 'Dónde están tus detecciones',
    'Folders of clips': 'Carpetas de clips',
    'Excel or CSV file': 'Archivo Excel o CSV',
    'Add species': 'Añadir especie',
    'Add one folder with several species': 'Añadir una carpeta con varias especies',
    'The score is the first number in each file name, for example 0.104 in 0.104_1_recording_12.0s_15.0s.wav.':
      'La puntuación es el primer número del nombre de cada archivo, por ejemplo 0.104 en 0.104_1_grabacion_12.0s_15.0s.wav.',
    'Your browser may say the files will be uploaded. They are not: BirdScore only reads their names, here on your computer.':
      'Puede que el navegador diga que se subirán los archivos. No es así: BirdScore solo lee sus nombres, aquí en tu ordenador.',
    'Choose a file': 'Elegir archivo',
    'Excel (.xlsx, .xls) or text (.csv, .tsv), with one row per detection.': 'Excel (.xlsx, .xls) o texto (.csv, .tsv), con una fila por detección.',
    'Sheet': 'Hoja',
    'Species': 'Especie',
    'Species name': 'Nombre de la especie',
    'Confidence score': 'Puntuación de confianza',
    'Positive or negative': 'Positivo o negativo',
    'Date': 'Fecha',
    'Time': 'Hora',
    'Site or recorder': 'Sitio o grabadora',
    'File name': 'Nombre de archivo',
    'What each value means': 'Qué significa cada valor',
    'Model': 'Modelo',
    '(optional)': '(opcional)',
    'For example, BirdNET or Perch': 'Por ejemplo, BirdNET o Perch',
    'It goes in the .csv files, not on the plot.': 'Se escribe en los archivos .csv, no en el gráfico.',
    'Plot settings': 'Ajustes del gráfico',
    'Saved automatically': 'Se guarda solo',
    'Threshold': 'Umbral',
    'Probability of a correct identification': 'Probabilidad de identificación correcta',
    'Another probability': 'Otra probabilidad',
    '0.97': '0,97',
    '0.50': '0,50',
    'Add': 'Añadir',
    'A confidence score to mark': 'Una puntuación de confianza que marcar',
    'Each value turned on is marked on the curve: a probability shows the score that reaches it, a score shows its probability. Turn them all off for no threshold.':
      'Cada valor activo se marca en la curva: una probabilidad muestra la puntuación que la alcanza y una puntuación muestra su probabilidad. Desactívalos todos para no marcar ningún umbral.',
    'Layout': 'Disposición',
    'One image per species': 'Una imagen por especie',
    'One image with all species': 'Una imagen con todas las especies',
    'Rows': 'Filas',
    'Columns': 'Columnas',
    'Titles': 'Títulos',
    'Image title': 'Título de la imagen',
    'Image subtitle': 'Subtítulo de la imagen',
    'Optional': 'Opcional',
    'The title of each plot starts as its species name. Add a species to change it.': 'El título de cada gráfico es, de entrada, el nombre de la especie. Añade una especie para cambiarlo.',
    'Plot titles in italics, as for scientific names': 'Títulos en cursiva, como los nombres científicos',
    'Axes': 'Ejes',
    'X axis name': 'Nombre del eje X',
    'Y axis name': 'Nombre del eje Y',
    'Points': 'Puntos',
    'Jitter the points': 'Dispersar los puntos (jitter)',
    'Amount of jitter': 'Cantidad de dispersión',
    'Spreads the points up and down so they overlap less. Their scores do not change.': 'Separa los puntos hacia arriba y hacia abajo para que se solapen menos. Sus puntuaciones no cambian.',
    'Language of the plot': 'Idioma del gráfico',
    'The axis names stay as you write them, in any language.': 'Los nombres de los ejes quedan como los escribas, en cualquier idioma.',
    'Advanced': 'Avanzado',
    'Score used in the regression': 'Puntuación usada en la regresión',
    'Logit of the score (recommended)': 'Logit de la puntuación (recomendado)',
    'Score as it is': 'La puntuación tal cual',
    'Both draw the same axes. The logit keeps every threshold between 0 and 1, and is the method of Wood and Kahl (2024).':
      'Las dos opciones dibujan los mismos ejes. El logit mantiene todos los umbrales entre 0 y 1, y es el método de Wood y Kahl (2024).',
    'Show the 95% confidence band': 'Mostrar la banda de confianza del 95 %',
    'Show the observed share of positives per 0.1 of score': 'Mostrar la proporción observada de positivos por cada 0,1 de puntuación',
    'Generate plots': 'Generar gráficos',
    'Your plots, the thresholds and the .csv with your data will appear here.': 'Aquí aparecerán tus gráficos, los umbrales y el .csv con tus datos.',
    'Results': 'Resultados',
    'Your data changed. Generate the plots again to include the changes.': 'Tus datos han cambiado. Vuelve a generar los gráficos para incluir los cambios.',
    'Plots': 'Gráficos',
    'Format': 'Formato',
    'SVG (vector)': 'SVG (vectorial)',
    'Resolution': 'Resolución',
    'Data': 'Datos',
    'CSV style': 'Estilo de CSV',
    'Comma (R, Python)': 'Coma (R, Python)',
    'Semicolon (Excel in Spanish)': 'Punto y coma (Excel en español)',
    'Detections (.csv)': 'Detecciones (.csv)',
    'Thresholds (.csv)': 'Umbrales (.csv)',
    'Thresholds': 'Umbrales',
    'How this was calculated': 'Cómo se ha calculado',
    'BirdScore runs in your browser. Your files stay on your computer.': 'BirdScore funciona en tu navegador. Tus archivos no salen de tu ordenador.',
    'Source code': 'Código fuente',
    'Remove every species and result from this page? Your folders and files are not touched.': '¿Quitar todas las especies y los resultados de esta página? Tus carpetas y archivos no se tocan.',
    'Keep': 'Conservar',
    'Remove': 'Quitar',
    'For example, Turdus merula': 'Por ejemplo, Turdus merula',
    'Positive': 'Positivo',
    'Negative': 'Negativo',
    'Browse the Positive folder': 'Buscar la carpeta de positivos',
    'Browse the Negative folder': 'Buscar la carpeta de negativos',
    'Browse folder': 'Buscar carpeta',
    'Remove this species': 'Quitar esta especie',
    // Messages
    'Day mode': 'Modo día',
    'Night mode': 'Modo noche',
    'no score at the start of the name': 'no hay una puntuación al principio del nombre',
    'the first number is above 1': 'el primer número es mayor que 1',
    'not an audio file': 'no es un archivo de audio',
    'No folder yet': 'Aún sin carpeta',
    '{n} clips, scores {lo} to {hi}': '{n} clips, puntuaciones de {lo} a {hi}',
    '{n} clip, score {lo}': '{n} clip, puntuación {lo}',
    'No clips with a score in this folder.': 'Esta carpeta no tiene clips con puntuación.',
    'Check this one: the folder is called “{folder}”.': 'Compruébalo: la carpeta se llama «{folder}».',
    '{n} files not used': '{n} archivos sin usar',
    '{n} file not used': '{n} archivo sin usar',
    'No folders named Positive or Negative were found inside that folder.': 'Dentro de esa carpeta no hay carpetas llamadas Positive o Negative.',
    'Reading {file}…': 'Leyendo {file}…',
    '{file} could not be read as a table. Save it as .xlsx or .csv, with column names in the first row, and try again.':
      'No se ha podido leer {file} como una tabla. Guárdalo como .xlsx o .csv, con los nombres de las columnas en la primera fila, y vuelve a intentarlo.',
    '{file} (last used)': '{file} (el último usado)',
    'All rows are one species': 'Todas las filas son de una especie',
    'Choose a column': 'Elige una columna',
    'Not in this file': 'No está en este archivo',
    'This column has {n} different values. Check that it is the one that says positive or negative.': 'Esta columna tiene {n} valores distintos. Comprueba que sea la que indica positivo o negativo.',
    'Meaning of {value}': 'Significado de {value}',
    'Ignore': 'Ignorar',
    '{n} rows': '{n} filas',
    '{n} row': '{n} fila',
    '{n} detections: {pos} positive, {neg} negative.': '{n} detecciones: {pos} positivas, {neg} negativas.',
    '{n} detection: {pos} positive, {neg} negative.': '{n} detección: {pos} positivas, {neg} negativas.',
    '{n} rows not used: {a} without a species, {b} without a score from 0 to 1, {c} without a result, {d} set to Ignore.':
      '{n} filas sin usar: {a} sin especie, {b} sin una puntuación de 0 a 1, {c} sin resultado, {d} marcadas como Ignorar.',
    '{n} row not used: {a} without a species, {b} without a score from 0 to 1, {c} without a result, {d} set to Ignore.':
      '{n} fila sin usar: {a} sin especie, {b} sin una puntuación de 0 a 1, {c} sin resultado, {d} marcadas como Ignorar.',
    'Add the Positive and Negative folders of at least one species.': 'Añade las carpetas de positivos y negativos de al menos una especie.',
    'Choose a file and its columns first.': 'Primero elige un archivo y sus columnas.',
    'Write a probability above 0 and below 1, for example 0.97.': 'Escribe una probabilidad mayor que 0 y menor que 1, por ejemplo 0,97.',
    'Write a score from 0 to 1, for example 0.50.': 'Escribe una puntuación de 0 a 1, por ejemplo 0,50.',
    'Title': 'Título',
    'Subtitle': 'Subtítulo',
    'Write the species name.': 'Escribe el nombre de la especie.',
    'Another row already has this name.': 'Otra fila ya tiene este nombre.',
    'Plots ready: {n} species, {m} clips.': 'Gráficos listos: {n} especies, {m} clips.',
    'Plots ready: one species, {m} clips.': 'Gráficos listos: una especie, {m} clips.',
    '{n} plots do not fit there, so the image has {rows} rows.': '{n} gráficos no caben ahí, así que la imagen tiene {rows} filas.',
    'All species': 'Todas las especies',
    '{n} species, {m} clips': '{n} especies, {m} clips',
    'One species, {m} clips': 'Una especie, {m} clips',
    'Download all (.zip)': 'Descargar todo (.zip)',
    'Download plot': 'Descargar gráfico',
    'Download {name} as {format}': 'Descargar {name} en {format}',
    '95% CI {lo} to {hi}': 'IC del 95 %: de {lo} a {hi}',
    'Score {score}': 'Puntuación {score}',
    'There are no negative clips, so no curve can be fitted.': 'No hay clips negativos, así que no se puede ajustar ninguna curva.',
    'There are no positive clips, so no curve can be fitted.': 'No hay clips positivos, así que no se puede ajustar ninguna curva.',
    'All clips have the same score, so no curve can be fitted.': 'Todos los clips tienen la misma puntuación, así que no se puede ajustar ninguna curva.',
    'Positive and negative clips do not overlap, so no curve can be fitted: every negative scores {lo} or less and every positive {hi} or more.':
      'Los clips positivos y negativos no se solapan, así que no se puede ajustar ninguna curva: todos los negativos puntúan {lo} o menos y todos los positivos {hi} o más.',
    'Every negative clip scores higher than every positive clip, so no curve can be fitted. Check that the folders or values are not swapped.':
      'Todos los clips negativos puntúan más que todos los positivos, así que no se puede ajustar ninguna curva. Comprueba que las carpetas o los valores no estén intercambiados.',
    'Only {n} negative clips: the curve is very uncertain.': 'Solo {n} clips negativos: la curva es muy incierta.',
    'Only {n} negative clip: the curve is very uncertain.': 'Solo {n} clip negativo: la curva es muy incierta.',
    'Only {n} positive clips: the curve is very uncertain.': 'Solo {n} clips positivos: la curva es muy incierta.',
    'Only {n} positive clip: the curve is very uncertain.': 'Solo {n} clip positivo: la curva es muy incierta.',
    'Higher scores are not more often correct here, so no threshold is given. Check that the folders or values are not swapped.':
      'Aquí las puntuaciones altas no aciertan más a menudo, así que no se da ningún umbral. Comprueba que las carpetas o los valores no estén intercambiados.',
    'A probability of {p} is not reached at any score from 0 to 1.': 'Ninguna puntuación de 0 a 1 alcanza una probabilidad de {p}.',
    'The threshold for a probability of {value} lies outside the scores you checked ({low} to {high}), so it is an extrapolation.':
      'El umbral para una probabilidad de {value} queda fuera de las puntuaciones que has revisado (de {low} a {high}), así que es una extrapolación.',
    'The score {value} lies outside the scores you checked ({low} to {high}), so its probability is an extrapolation.':
      'La puntuación {value} queda fuera de las que has revisado (de {low} a {high}), así que su probabilidad es una extrapolación.',
    'Most positive clips are from {pos} and most negative clips from {neg}, so the curve cannot separate the effect of the score from that of the year.':
      'La mayoría de los clips positivos son de {pos} y la mayoría de los negativos de {neg}, así que la curva no puede separar el efecto de la puntuación del efecto del año.',
    'Most positive clips are from {pos} and most negative clips from {neg}, so the curve cannot separate the effect of the score from that of the site or recorder.':
      'La mayoría de los clips positivos son de {pos} y la mayoría de los negativos de {neg}, así que la curva no puede separar el efecto de la puntuación del efecto del sitio o la grabadora.',
    'The plot shows a sample of {n} points per group. The regression uses every clip.': 'El gráfico muestra una muestra de {n} puntos por grupo. La regresión usa todos los clips.',
    'Score for p = {v}': 'Puntuación para p = {v}',
    'p at score {v}': 'p con puntuación {v}',
    'not reached': 'no se alcanza',
    'no limit': 'sin límite',
    'Recordings': 'Grabaciones',
    'In brackets, the 95% confidence interval.': 'Entre paréntesis, el intervalo de confianza del 95 %.',
    'BirdScore fits one logistic regression per species by maximum likelihood, with no penalty: p = 1 / (1 + exp(−(b0 + b1 · x))), where p is the probability that a detection is correct and x is the logit of the confidence score, log(s / (1 − s)), as in Wood and Kahl (2024). Scores of exactly 0 or 1 count as 0.000001 and 0.999999.':
      'BirdScore ajusta una regresión logística por especie por máxima verosimilitud, sin penalización: p = 1 / (1 + exp(−(b0 + b1 · x))), donde p es la probabilidad de que una detección sea correcta y x es el logit de la puntuación de confianza, log(s / (1 − s)), como en Wood y Kahl (2024). Las puntuaciones de exactamente 0 o 1 cuentan como 0,000001 y 0,999999.',
    'BirdScore fits one logistic regression per species by maximum likelihood, with no penalty: p = 1 / (1 + exp(−(b0 + b1 · x))), where p is the probability that a detection is correct and x is the confidence score itself.':
      'BirdScore ajusta una regresión logística por especie por máxima verosimilitud, sin penalización: p = 1 / (1 + exp(−(b0 + b1 · x))), donde p es la probabilidad de que una detección sea correcta y x es la propia puntuación de confianza.',
    'The band is the 95% Wald interval, computed on the logit scale. A threshold is the score at which the curve reaches the chosen probability, and its interval runs between the scores at which the band reaches it. Both treat clips as independent. Clips from one recording or night often are not, so the real uncertainty can be larger.':
      'La banda es el intervalo de Wald del 95 %, calculado en la escala logit. Un umbral es la puntuación en la que la curva alcanza la probabilidad elegida, y su intervalo va de una a otra de las puntuaciones en las que la banda la alcanza. Ambos tratan los clips como independientes. Los clips de una misma grabación o noche a menudo no lo son, así que la incertidumbre real puede ser mayor.',
    'The curve describes the detections you checked: this species, this model and these recordings. It holds only across the scores checked, and the faded line beyond them is an extrapolation. It estimates how often a detection at a given score is correct, which is a kind of precision. It says nothing about the calls the model missed (recall), which statisticians usually call the true positive rate.':
      'La curva describe las detecciones que has revisado: esta especie, este modelo y estas grabaciones. Solo vale dentro de las puntuaciones revisadas, y la línea atenuada más allá de ellas es una extrapolación. Estima con qué frecuencia es correcta una detección con una puntuación dada, que es una forma de precisión. No dice nada de los cantos que el modelo no detectó (la exhaustividad o recall), que en estadística suele llamarse tasa de verdaderos positivos.',
    'Preparing the image…': 'Preparando la imagen…',
    'Preparing the images…': 'Preparando las imágenes…',
    'The image is too large at this resolution. Choose a lower one.': 'La imagen es demasiado grande con esta resolución. Elige una menor.',
    // The plot
    'Logistic regression': 'Regresión logística',
    '95% confidence band': 'Banda de confianza del 95 %',
    'Extrapolated': 'Extrapolada',
    'Observed share of positives': 'Proporción observada de positivos',
    'No curve can be fitted': 'No se puede ajustar ninguna curva',
    'Logistic regressions': 'Regresiones logísticas',
    '{n} positive': '{n} positivos',
    '{n} negative': '{n} negativos',
    '1 positive': '1 positivo',
    '1 negative': '1 negativo',
  };

  const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s);
  const tIn = (language, key, vars) => fill((language === 'es' && ES[key]) || key, vars);
  const t = (key, vars) => tIn(lang, key, vars);
  const numIn = (language, x, digits, most = digits) => Number(x).toLocaleString(language === 'es' ? 'es-ES' : 'en-GB',
    digits == null ? { maximumFractionDigits: 3 } : { minimumFractionDigits: digits, maximumFractionDigits: most });
  const num = (x, digits, most) => numIn(lang, x, digits, most);
  const tn = (n, one, other, vars) => t(n === 1 ? one : other, { n: num(n), ...vars });

  // Static texts: the English is kept on the element the first time, so the page can switch back and forth
  function applyLang(root = document) {
    document.documentElement.lang = lang;
    for (const el of root.querySelectorAll('[data-i18n]')) {
      el.dataset.en ??= norm(el.textContent);
      el.textContent = t(el.dataset.en);
    }
    for (const el of root.querySelectorAll('[data-i18n-attr]')) {
      for (const name of el.dataset.i18nAttr.split(' ')) {
        const key = `en_${name.replace(/-/g, '_')}`;
        el.dataset[key] ??= el.getAttribute(name);
        el.setAttribute(name, t(el.dataset[key]));
      }
    }
  }
  function setLang(next) {
    lang = next === 'es' ? 'es' : 'en';
    try { localStorage.setItem('birdscore.lang', lang); } catch { /* storage blocked */ }
    applyLang();
  }
  return { ES, t, tn, tIn, num, numIn, getLang: () => lang, setLang, applyLang };
})();
