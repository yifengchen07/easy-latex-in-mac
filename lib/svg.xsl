<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:s="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns="http://www.w3.org/2000/svg"
    exclude-result-prefixes="s">
  <xsl:output method="xml" encoding="UTF-8" omit-xml-declaration="yes"/>
  <xsl:variable name="token" select="'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.:-'"/>
  <xsl:variable name="base64" select="'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/='"/>
  <xsl:variable name="geometry" select="'|id|version|viewBox|preserveAspectRatio|width|height|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|fx|fy|fr|d|points|transform|clipPathUnits|gradientUnits|gradientTransform|spreadMethod|patternUnits|patternContentUnits|patternTransform|maskUnits|maskContentUnits|offset|fill-opacity|fill-rule|stroke-opacity|stroke-width|stroke-linejoin|stroke-linecap|stroke-dasharray|stroke-dashoffset|stroke-miterlimit|clip-rule|opacity|stop-opacity|vector-effect|'"/>
  <xsl:variable name="paint" select="'|fill|stroke|color|stop-color|clip-path|mask|'"/>

  <xsl:template match="/">
    <xsl:apply-templates select="s:svg"/>
  </xsl:template>

  <xsl:template match="s:svg | s:g | s:defs | s:path | s:rect | s:line | s:circle | s:ellipse |
                       s:polyline | s:polygon | s:clipPath | s:mask | s:pattern | s:symbol |
                       s:use | s:linearGradient | s:radialGradient | s:stop">
    <xsl:element name="{local-name()}">
      <xsl:apply-templates select="@* | *"/>
    </xsl:element>
  </xsl:template>

  <!-- Keep link contents as artwork, with no navigation target. -->
  <xsl:template match="s:a">
    <g><xsl:apply-templates select="*"/></g>
  </xsl:template>

  <xsl:template match="s:image">
    <xsl:variable name="href" select="string((@xlink:href | @href)[1])"/>
    <xsl:if test="(starts-with($href, 'data:image/png;base64,') or starts-with($href, 'data:image/jpeg;base64,'))
               and string-length(substring-after($href, ',')) &gt; 0
               and translate(substring-after($href, ','), $base64, '') = ''">
      <image xlink:href="{$href}">
        <xsl:apply-templates select="@*[local-name() != 'href']"/>
      </image>
    </xsl:if>
  </xsl:template>

  <xsl:template match="@href | @xlink:href">
    <xsl:if test="starts-with(., '#') and string-length(.) &gt; 1 and translate(substring(., 2), $token, '') = ''">
      <xsl:attribute name="xlink:href"><xsl:value-of select="."/></xsl:attribute>
    </xsl:if>
  </xsl:template>

  <xsl:template match="@*">
    <xsl:variable name="name" select="concat('|', local-name(), '|')"/>
    <xsl:variable name="value" select="normalize-space(.)"/>
    <xsl:variable name="inside" select="substring($value, 6, string-length($value) - 6)"/>
    <xsl:if test="namespace-uri() = '' and (contains($geometry, $name) or (contains($paint, $name) and
         (translate($value, concat($token,'#'), '') = '' or
          (starts-with($value, 'url(#') and substring($value, string-length($value)) = ')'
           and string-length($inside) &gt; 0 and translate($inside, $token, '') = '') or
          (starts-with($value, 'rgb(') and translate(substring($value, 5), '0123456789.,% )', '') = ''))))">
      <xsl:copy/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="*"/>
</xsl:stylesheet>
