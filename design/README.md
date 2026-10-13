# Clear Structure

Use open space and exact alignment to show order. Give each element a clear position. Use the spoolctl card as the layout guide. Check each margin with care.

Use cream for the background, dark ink for the name, and blue for the accent. These colors come from the inferctl website. Keep each color consistent with its function.

Make the name the largest element. Use the existing two-bar symbol beside it. Use JetBrains Mono Regular and Bold to keep the text style consistent with the related tool. Check the size and spacing of each line.

Keep the text short. Give the main message more space than the supporting text. Put the domain at the lower right. Check the final image at full size and at link preview size.

## Files

The link preview card is `../public/og.png` (2400 × 1260 pixels).
The editable source is `og.svg`. The shared page layout sets the Open Graph
and Twitter image metadata for all pages.

To export the source, install JetBrains Mono Regular and Bold. From the website
directory, run:

```sh
node --input-type=module -e "import sharp from 'sharp'; await sharp('design/og.svg').png().toFile('public/og.png');"
```

Check the exported image before you publish it. The font must match the source.
