/**
 * Copyright 2018 Andrei Kashcha (http://github.com/anvaka)
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all copies
 * or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
module.exports = getSunBurstPath;

/**
 * For a given tree, builds SVG path that renders SunBurst
 * diagram
 * 
 * @param {Object} tree - a regular javascript object with single
 * property: tree.children - array of tree-children.
 * 
 * @param {Object} options - see below.
 */
function getSunBurstPath(tree, options) {
  // TODO: Validate options
  options = options || {};

  // Radius of the inner circle.
  var initialRadius = getNumber(options.initialRadius, 100);
  // width of a single level
  var levelStep = getNumber(options.levelStep, 10);
  // Array of colors. Applied only on the top level.
  var colors = options.colors;
  if (!colors) colors = ['#f2ad52', '#e99e9b', '#ed684c', '#c03657', '#642b1c', '#132a4e'];

  // Initial rotation of the circle in radians.
  var startAngle = getNumber(options.startAngle, 0);

  var wrap = options.wrap;
  var stroke = options.stroke;
  var strokeWidth = options.strokeWidth;
  var beforeClose = options.beforeClose;

  // Below is implementation.
  var totalLeaves = countLeaves(tree);
  var svgElements = [];
  svgElements.push(circle(initialRadius));
  if (options.centerText) {
    svgElements.push('<text text-anchor="middle" class="center-text" y="8">' + options.centerText + '</text>');
  }

  var level = 1;

  var path = '0';
  tree.path = path; // TODO: Don't really need to do this?

  tree.children.forEach(function (child, i) {
    // if child prefers explicit placement - respect it.
    var endAngle, thisStartAngle;
    if (child.startAngle !== undefined && child.endAngle !== undefined) {
      thisStartAngle = child.startAngle;
      endAngle = child.endAngle;
    } else {
      // otherwise just count based on number of leaves. Note: we may end up
      // in inconsistent state if some children use explicit placement
      // while the other don't. Explicit placement is advanced feature,
      // and I hope that if you use it, you understand the responsibility.
      thisStartAngle = startAngle;
      endAngle = startAngle + 2 * Math.PI * child.leaves / totalLeaves;

      startAngle = endAngle;
    }

    var thisPath = path + ':' + i;
    child.path = thisPath;

    if (thisStartAngle !== endAngle) {
      // we don't want to draw empty slices.
      var arcPath = pieSlice(initialRadius, level * levelStep, thisStartAngle, endAngle);
      var baseColor = getColor(child, i); 
      svgElements.push(arc(arcPath, baseColor, 0, child));
    }

    // descend to children.
    drawChildren(thisStartAngle, endAngle, child, svgElements, level, baseColor, thisPath);
  });

  var sunBurstPaths = svgElements.join('\n');

  if (wrap) {
    return wrapIntoSVG(sunBurstPaths);
  }

  return sunBurstPaths;

  function wrapIntoSVG(paths) {
    var depth = getDepth(tree, 0);
    var min = depth * levelStep + initialRadius;
    return '<svg viewBox="' + [-min, -min, min * 2, min * 2].join(' ') + '">' + 
      '<g id="scene">' + paths + '</g>' +
    '</svg>';
  }

  function drawChildren(startAngle, endAngle, tree, pathElements, level, color, path) {
    // TODO: Consider merging drawChildren with first recursive call.
    if (!tree.children) return;

    var arcLength = Math.abs(startAngle - endAngle);
    var totalLeaves = tree.leaves;
    tree.children.forEach(function (child, i) {
      var da = arcLength * child.leaves / totalLeaves;
      var endAngle = startAngle + da;
      var arcPath = pieSlice(initialRadius + level * levelStep, levelStep, startAngle, endAngle);
      var thisPath = path + ':' + i;
      child.path = thisPath;
      pathElements.push(arc(arcPath, child.color || color, level, child));

      drawChildren(startAngle, endAngle, child, pathElements, level + 1, color, thisPath);

      startAngle += da;
    });
  }

  function getColor(element, i) {
    if (element.color) return element.color;

    return colors[i % colors.length];
  }

  function arc(pathData, color, level, child) {
    var pathMarkup = '<path d="' + pathData + '" fill="' + color + '" class="arc level-' + level + '" data-path="' + child.path + '" ';

    if (stroke) {
      pathMarkup += ' stroke="' + stroke +'" ';
    }

    if (strokeWidth) {
      pathMarkup += ' stroke-width="' + strokeWidth + '" ';
    }
    if (beforeClose) {
      pathMarkup += beforeClose(child);
    }

    pathMarkup += '></path>'


    return pathMarkup;
  }
}

function polarToCartesian(centerX, centerY, radius, angle) {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
}

function arcSegment(radius, startAngle, endAngle) {
  var forward = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 1;

  var cx = 0;
  var cy = 0;

  var start = polarToCartesian(cx, cy, radius, startAngle);
  var end = polarToCartesian(cx, cy, radius, endAngle);
  var da = Math.abs(startAngle - endAngle);
  var flip = da > Math.PI ? 1 : 0;
  var d = ["M", start.x, start.y, "A", radius, radius, 0, flip, forward, end.x, end.y].join(" ");

  return {
    d: d,
    start: start,
    end: end
  };
}

function pieSlice(r, width, startAngle, endAngle) {
  var inner = arcSegment(r, startAngle, endAngle);
  var out = arcSegment(r + width, endAngle, startAngle, 0);
  return inner.d + 'L' + out.start.x + ' ' + out.start.y + out.d + 'L' + inner.start.x + ' ' + inner.start.y;
}

function circle(r) {
  // TODO: Don't hard-code fill?
  return '<circle r=' + r + ' cx=0 cy=0 fill="#fafafa" data-path="0"></circle>';
}

function countLeaves(treeNode) {
  if (treeNode.leaves) return treeNode.leaves;

  var leaves = 0;
  if (treeNode.children) {
    treeNode.children.forEach(function (child) {
      leaves += countLeaves(child);
    });
  } else {
    leaves = 1;
  }
  treeNode.leaves = leaves;
  return leaves;
}

function getDepth(tree) {
  var maxDepth = 0;

  visit(tree, 0);

  return maxDepth;


  function visit(tree, depth) {
    if (tree.children) {
      tree.children.forEach(function(child) {
        visit(child, depth + 1);
      });
    }
    if (depth > maxDepth) maxDepth = depth;
  }
}

function getNumber(x, defaultNumber) {
  return Number.isFinite(x) ? x : defaultNumber;
}