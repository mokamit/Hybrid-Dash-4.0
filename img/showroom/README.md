# Showroom car images

The Showroom (Garage -> Showroom) shows a real image of each car. For a car it looks, in this order, for:

1. the car's own photo, set in the Garage (always wins);
2. `img/showroom/<model>-<colour>.webp` / `.png` / `.jpg` - an image of exactly this model in exactly this colour;
3. `img/showroom/<model>.png` - ONE neutral render of the model (white or light silver paint, transparent
   background). The app tints it to the car's colour, so one image covers every colour;
4. `img/showroom/<model>.jpg` - a photo of the real car the model stands for, in its own livery (not tinted).
   The nine bundled photos are from Wikimedia Commons; authors and licences are in `CREDITS.md`
   and `quellen.json`;
5. a drawn placeholder.

`<model>`: bmw, porsche911, fordmustang, ferrari, audi, mclaren, mercedes, redbull, vwkaefer, or `standard`
for a car without a model.
`<colour>`: weiss, schwarz, rot, blau, gruen, gelb, lila, orange.

Best results: side or front three-quarter view, the car filling about 85 % of the width, 1200 x 800 px,
studio lighting. For the tintable render (3) the paint must be white or light silver and the background
transparent - shadows, glass, wheels and lights keep their own tones.
