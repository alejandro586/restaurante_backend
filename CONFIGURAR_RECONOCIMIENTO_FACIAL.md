# RIMBERIO - Reconocimiento Facial sin código

Esta mejora deja todo el código de RIMBERIO preparado. La inteligencia artificial no se programa dentro del proyecto: se construye visualmente en **Roboflow Workflows** y el backend solo consume su salida.

## Lo que ya está implementado en RIMBERIO

- Curso 2: **Reconocimiento Facial**.
- Permisos independientes para cada actividad.
- Administrador: acceso a todas las actividades.
- Usuario: solo actividades asignadas.
- Reconocimiento en vivo mediante cámara.
- Análisis de una imagen JPG/PNG/WEBP.
- Historial de resultados.
- Estadísticas.
- Datos del usuario autenticado junto al resultado.
- Las imágenes no se guardan en Supabase.
- API key de Roboflow únicamente en el backend.

## Flujo visual de 7 nodos

Construye el Workflow de forma visual con estos siete pasos:

1. **Image Input** - entrada de imagen.
2. **Object Detection Model** - detectar el rostro.
3. **Property Definition / Count Items** - contar las caras detectadas.
4. **Crop** - recortar el rostro detectado.
5. **Single-Label Classification Model** - clasificar la expresión visible.
6. **Classification Label Visualization** - visualizar la etiqueta.
7. **Workflow Output** - devolver a RIMBERIO la salida del clasificador.

### Modelo sugerido para detectar rostro

Usa un modelo público de detección de rostro de Roboflow Universe. El modelo `face-detection-mik1i/27` es una opción pública. Configura:

- clase: `face`
- confidence: aproximadamente `0.60`
- max detections: `1`

### Modelo sugerido para clasificación

Usa un modelo público de clasificación de expresiones. Una opción es:

`facial-emotion-recognition-nc1mc/1`

Sus clases incluyen `neutral`, `angry`, `disgust`, `fear`, `happy`, `sad` y `surprise`.

**Importante:** en la salida del Workflow agrega el resultado del bloque de clasificación. RIMBERIO busca los campos `top`, `confidence` y `predictions` de la salida del modelo.

## 1. Ejecutar la migración en Supabase

Abre Supabase -> SQL Editor y ejecuta:

`migrations/006_reconocimiento_facial_nocode.sql`

La migración:

- reutiliza `Modulo 2` si existe;
- lo convierte en `Reconocimiento Facial`;
- crea las cuatro actividades;
- crea `facial_analyses`;
- no crea una tabla de fotografías ni plantillas biométricas.

## 2. Crear el Workflow en Roboflow

1. Crea o abre tu Workspace.
2. Entra a **Workflows**.
3. Crea un Workflow nuevo.
4. Añade los siete nodos anteriores.
5. Prueba una fotografía desde **Test Workflow**.
6. Confirma que el JSON final contiene el resultado del bloque de clasificación.
7. Publica/guarda el Workflow.

## 3. Variables de entorno del backend

En Render agrega:

```env
ROBOFLOW_API_URL=https://serverless.roboflow.com
ROBOFLOW_API_KEY=TU_API_KEY
ROBOFLOW_WORKSPACE=TU_WORKSPACE
ROBOFLOW_WORKFLOW_ID=TU_WORKFLOW_ID
```

No pongas `ROBOFLOW_API_KEY` en Vercel ni en archivos `VITE_*`.

Después de guardar las variables, vuelve a desplegar el backend.

## 4. Asignar permisos

El administrador no necesita una asignación personal: el backend ya le concede acceso global.

Para un trabajador, desde **Administración -> Usuarios y permisos** asigna el curso `Reconocimiento Facial` y las actividades que correspondan:

- `facial.en_vivo`
- `facial.analizar_imagen`
- `facial.historial`
- `facial.estadisticas`

## 5. Prueba final

1. Inicia sesión.
2. En **Mis cursos**, entra a `Reconocimiento Facial`.
3. Abre `Reconocimiento en vivo`.
4. Autoriza la cámara.
5. Pulsa `Analizar fotograma`.
6. Debe mostrarse la expresión visible, confianza y datos del usuario autenticado.
7. Comprueba `Historial` y `Estadísticas`.

## Sobre el login facial

Esta entrega no crea una base biométrica de rostros para identificar personas durante el login. Para acceso rápido se recomienda una segunda mejora con **Passkeys / Windows Hello / Face ID**, que permite usar la biometría del dispositivo sin almacenar la cara en RIMBERIO. Es mejor mantenerla separada del Workflow académico de siete nodos.
