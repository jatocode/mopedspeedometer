#!/usr/bin/env python3
"""
csv_to_kml.py - Convert mopedspeedometer track.csv to KML for Google Earth.

Usage:
    python3 tools/csv_to_kml.py test/track.csv            # writes test/track.kml
    python3 tools/csv_to_kml.py test/track.csv out.kml    # custom output path
"""

import csv
import sys
import os
from xml.etree.ElementTree import Element, SubElement, ElementTree, indent


def csv_to_kml(csv_path, kml_path):
    points = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            points.append({
                "index":     int(row["#"]),
                "ms":        int(row["ms"]),
                "lat":       float(row["lat"]),
                "lon":       float(row["lon"]),
                "speed_kmh": float(row["speed_kmh"]),
                "freq_hz":   float(row["freq_hz"]),
            })

    if not points:
        print("No data rows found.")
        return

    track_name = os.path.splitext(os.path.basename(csv_path))[0]

    kml = Element("kml", xmlns="http://www.opengis.net/kml/2.2")
    doc = SubElement(kml, "Document")
    SubElement(doc, "name").text = track_name

    # Red track line
    style = SubElement(doc, "Style", id="trackStyle")
    line_style = SubElement(style, "LineStyle")
    SubElement(line_style, "color").text = "ff0000ff"   # AABBGGRR: red, fully opaque
    SubElement(line_style, "width").text = "3"

    # Track as a single LineString
    folder = SubElement(doc, "Folder")
    SubElement(folder, "name").text = "Track"
    pm_track = SubElement(folder, "Placemark")
    SubElement(pm_track, "name").text = "Route"
    SubElement(pm_track, "styleUrl").text = "#trackStyle"
    ls = SubElement(pm_track, "LineString")
    SubElement(ls, "tessellate").text = "1"
    SubElement(ls, "coordinates").text = "\n".join(
        "{},{},0".format(p["lon"], p["lat"]) for p in points
    )

    # One placemark per point with speed/time in the description
    wp_folder = SubElement(doc, "Folder")
    SubElement(wp_folder, "name").text = "Points"
    for p in points:
        pm = SubElement(wp_folder, "Placemark")
        SubElement(pm, "name").text = "#{}".format(p["index"])
        SubElement(pm, "description").text = (
            "Time: {:.1f} s\nSpeed: {:.1f} km/h\nFreq: {:.4f} Hz".format(
                p["ms"] / 1000, p["speed_kmh"], p["freq_hz"])
        )
        pt = SubElement(pm, "Point")
        SubElement(pt, "coordinates").text = "{},{},0".format(p["lon"], p["lat"])

    tree = ElementTree(kml)
    indent(tree, space="  ")
    with open(kml_path, "wb") as f:
        f.write(b'<?xml version="1.0" encoding="UTF-8"?>\n')
        tree.write(f, encoding="utf-8", xml_declaration=False)

    print("Written {} points -> {}".format(len(points), kml_path))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    in_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(in_path)[0] + ".kml"
    csv_to_kml(in_path, out_path)
