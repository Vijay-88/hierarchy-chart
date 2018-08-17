/*Copyright (c) 2013-2016, Rob Schmuecker
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* The name Rob Schmuecker may not be used to endorse or promote products
  derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL MICHAEL BOSTOCK BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.*/


// Get JSON data
var treeData = {
    "name": "Vinod",
    "position": "Director",
    "parent_id" :0,
     "id" : 1,
    "children": [{
        "name": "Prashant",
        "position": "VP",
        "parent_id" :1,
        "id" : 11,
        "children": [
         {
            "name": "Vijay",
            "parent_id" :11,
            "position": "Manager",
            "id" : 2,
            "children": [{
                "name": "Suyash",
                "position": "Assistant Manager",
                "parent_id" :2,
                "id" : 569
            }, {
                "name": "Shreyank",
                "position": "Assistant Manager",
                "parent_id" :2,
                "id" : 564
            }, {
                "name": "Jiten",
                "position": "Assistant Manager",
                "parent_id" :2,
                "id" : 561
            }]
        }, {
            "name": "Nilesh",
            "parent_id" :11,
            "position": "Assistant VP",
            "id" : 3,
            "children": [{
                "name": "Nikhil",
                "position": "Assistant Manager",
                "parent_id" :3,
                "id" : 26
            }, {
                "name": "Gopi",
                "position": "Manager",
                "parent_id" :3,
                "id" : 25
            }, {
                "name": "Shreya",
                "position": "Assistant Manager",
                "parent_id" :3,
                "id" : 24
            }, {
                "name": "Abhijeet",
                "position": "Assistant Manager",
                "parent_id" :3,
                "id" : 23
            }, {
                "name": "Vinod",
                "position": "Manager",
                "parent_id" :3,
                "id" : 21
            }]
        }, {
            "name": "Sekhar",
            "position": "Manager",
            "parent_id" :11,
            "id" : 4,
            "children": [{
                "name": "Suneetha",
                "position": "Assistant Manager",
                "parent_id" :4,
                "id" : 2145
            }]
        }]
    }]
};

var orgChart = (function() {
        var _margin = {
            top:    20,
            right:  20,
            bottom: 20,
            left:   20
        },
        _root           = {},
        _nodes          = [],
        _counter        = 0,
        _svgroot        = null,
        _svg            = null,
        _tree           = null, 
        _diagonal       = null,
        _lineFunction   = null,
        _loadFunction   = null,
        /* Configuration */
        _duration       = 750,        /* Duration of the animations */
        _rectW          = 150,        /* Width of the rectangle */
        _rectH          = 50,         /* Height of the rectangle */
        _rectSpacing    = 20          /* Spacing between the rectangles */
        _fixedDepth     = 80,         /* Height of the line for child nodes */       
        _mode           = "line",     /* Choose the values "line" or "diagonal" */
        _callerNode     = null,
        _callerMode     = 0,
        selectedNode = null,
        draggingNode = null,
        panSpeed = 200,
        panBoundary = 20,
        zoomListener = undefined,
        dragListener = undefined,
        viewerWidth = null,
        viewerHeight = null,
   
        defLinearGradient = function(id, x1, y1, x2, y2, stopsdata) {
           var gradient = _svgroot.append("svg:defs")
                          .append("svg:linearGradient")
                            .attr("id", id)
                            .attr("x1", x1)
                            .attr("y1", y1)
                            .attr("x2", x2)
                            .attr("y2", y2)
                            .attr("spreadMethod", "pad");
           $.each(stopsdata, function(index, value) {
              gradient.append("svg:stop")
                      .attr("offset", value.offset)
                      .attr("stop-color", value.color)
                      .attr("stop-opacity", value.opacity);  
           });
        },
        defBoxShadow = function(id) {
           var filter = _svgroot.append("svg:defs")
                           .append("svg:filter")
                           .attr("id", id).attr("height", "150%").attr("width", "150%");
                           
           filter.append("svg:feOffset")
                 .attr("dx", "2").attr("dy", "2").attr("result", "offOut");  // how much to offset
           filter.append("svg:feGaussianBlur")
                 .attr("in", "offOut").attr("result", "blurOut").attr("stdDeviation", "2");     // stdDeviation is how much to blur
           filter.append("svg:feBlend")
                 .attr("in", "SourceGraphic").attr("in2", "blurOut").attr("mode", "normal");
        },
        collapse = function(d) {
            if (d.children) {
                d._children = d.children;
                d._children.forEach(collapse);
                d.children = null;
            }
        },
        expand = function(d) {
            if (d._children) {
                d.children = d._children;
                d.children.forEach(expand);
                d._children = null;
            }
        },
        update = function(source) {
           // Compute the new tree layout.
           _nodes = _tree.nodes(_root).reverse();
           var links = _tree.links(_nodes);
           // Normalize for fixed-depth.
           _nodes.forEach(function (d) {
              d.y = d.depth * _fixedDepth;
           });
           // Update the nodes
           var node = _svg.selectAll("g.node")
               .data(_nodes, function (d) {
               return d.id || (d.id = ++_counter);
           });
           // Enter any new nodes at the parent's previous position.
           var nodeEnter = node.enter().append("g")
                .call(dragListener)
               .attr("class", "node")
               .attr("transform", function (d) {
               return "translate(" + source.x0 + "," + source.y0 + ")";
           })
           .on("click", nodeclick);
           nodeEnter.append("rect")
                    .attr("width", _rectW)
                    .attr("height", _rectH)
                    .attr("fill", "#898989")
                    .attr("filter", "url(#boxShadow)");
           
           nodeEnter.append("rect")
                    .attr("width", _rectW)
                    .attr("height", _rectH)
                    .attr("id", function(d) {
                        return d.id;
                    })
                    .attr("fill", function (d) { return (d.children || d._children || d.hasChild) ? "url(#gradientchilds)" : "url(#gradientnochilds)"; })
                    .style("cursor", function (d) { return (d.children || d._children || d.hasChild) ? "pointer" : "default"; })
                    .attr("class", "box");

           nodeEnter.append("text")
                    .attr("x", _rectW / 2)
                    .attr("y", _rectH / 2)
                    .attr("dy", ".20em")
                    .attr("text-anchor", "middle")
                    .style("cursor", function (d) { return (d.children || d._children || d.hasChild) ? "pointer" : "default"; })
                    .text(function (d) {
                              return d.name;
                    });

                    nodeEnter.append("text")
                    .attr("x", _rectW / 2)
                    .attr("y", (_rectH + 20)/ 2)
                    .attr("dy", ".35em")
                    .attr("text-anchor", "middle")
                    .style("cursor", function (d) { return (d.children || d._children || d.hasChild) ? "pointer" : "default"; })
                    .text(function (d) {
                              return d.position;
                    });

            nodeEnter.append("circle")
                .attr('class', 'ghostCircle')
                .attr("r", 30)
                .attr("opacity", 0.2) // change this to zero to hide the target area
                .style("fill", "red")
                .attr('pointer-events', 'mouseover')
                .on("mouseover", function(node) {
                    overCircle(node);
                })
                .on("mouseout", function(node) {
                    outCircle(node);
                });

            
           // Transition nodes to their new position.
           var nodeUpdate = node.transition()
                                .duration(_duration)
                                .attr("transform", function (d) {
                                     return "translate(" + d.x + "," + d.y + ")";
                                });
           nodeUpdate.select("rect.box")
                     .attr("fill", function (d) {
                         return (d.children || d._children || d.hasChild) ? "url(#gradientchilds)" : "url(#gradientnochilds)";
                     });              
           // Transition exiting nodes to the parent's new position.
           var nodeExit = node.exit().transition()
                              .duration(_duration)
                              .attr("transform", function (d) {
                                  return "translate(" + source.x + "," + source.y + ")";
                              })
                              .remove();
                              
           // Update the links
           var link = _svg.selectAll("path.link")
                         .data(links, function (d) {
                               return d.target.id;
                         });
           
           if (_mode === "line") {
              // Enter any new links at the parent's previous position.
              link.enter().append("path" , "g")
                  .attr("class", "link")
                  .attr("d", function(d) {
                                var u_line = (function (d) {
                                   var u_linedata = [{"x": d.source.x0 + parseInt(_rectW / 2), "y": d.source.y0 + _rectH + 2 },
                                                     {"x": d.source.x0 + parseInt(_rectW / 2), "y": d.source.y0 + _rectH + 2 },
                                                     {"x": d.source.x0 + parseInt(_rectW / 2), "y": d.source.y0 + _rectH + 2 },
                                                     {"x": d.source.x0 + parseInt(_rectW / 2), "y": d.source.y0 + _rectH + 2 }];
                                   return u_linedata;
                                })(d);
                                return _lineFunction(u_line);
                             });
                             
              // Transition links to their new position. 
              link.transition()
                 .duration(_duration)
                 .attr("d", function(d) {
                             var u_line = (function (d) {
                                var u_linedata = [{"x": d.source.x + parseInt(_rectW / 2), "y": d.source.y + _rectH },
                                                  {"x": d.source.x + parseInt(_rectW / 2), "y": d.target.y - _margin.top / 2 },
                                                  {"x": d.target.x + parseInt(_rectW / 2), "y": d.target.y - _margin.top / 2 },
                                                  {"x": d.target.x + parseInt(_rectW / 2), "y": d.target.y }];                                                  
                                return u_linedata;
                             })(d);
                             return _lineFunction(u_line);
                          });
                             
              // Transition exiting nodes to the parent's new position.
              link.exit().transition()
                  .duration(_duration)
                  .attr("d", function(d) {
                                  /* This is needed to draw the lines right back to the caller */
                                  var u_line = (function (d) {
                                     var u_linedata = [{"x": _callerNode.x + parseInt(_rectW / 2), "y": _callerNode.y + _rectH + 2 },
                                                       {"x": _callerNode.x + parseInt(_rectW / 2), "y": _callerNode.y + _rectH + 2 },
                                                       {"x": _callerNode.x + parseInt(_rectW / 2), "y": _callerNode.y + _rectH + 2 },
                                                       {"x": _callerNode.x + parseInt(_rectW / 2), "y": _callerNode.y + _rectH + 2 }];
                                     return u_linedata;
                                  })(d);
                                  return _lineFunction(u_line);
                             }).each("end", function() { _callerNode = null; /* After transition clear the caller node variable */ });
           } else if (_mode === "diagonal") {
              // Enter any new links at the parent's previous position.
              link.enter().insert("path" , "g")
                  .attr("class", "link")
                  .attr("x", _rectW / 2)
                  .attr("y", _rectH / 2)
                  .attr("d", function (d) {
                     var o = {
                        x: source.x0,
                        y: source.y0
                     };
                     return _diagonal({
                           source: o,
                           target: o
                     });
                  });
                
              // Transition links to their new position.
              link.transition()
                  .duration(_duration)
                  .attr("d", _diagonal);
                  
              // Transition exiting nodes to the parent's new position.
              link.exit().transition()
                  .duration(_duration)
                  .attr("d", function (d) {
                      var o = {
                          x: source.x,
                          y: source.y
                      };
                      return _diagonal({
                          source: o,
                          target: o
                      });
                  })
                  .remove();
           }
           // Stash the old positions for transition.
           _nodes.forEach(function (d) {
               d.x0 = d.x;
               d.y0 = d.y;
           });
        },
        // Toggle children on click.
        nodeclick = function(d) {      
           if (!d.children && !d._children && d.hasChild) {
              // If there are no childs --> Try to load child nodes
              _loadFunction(d, function(childs) {
                 var response = {id: d.id, 
                                 desc: d.desc, 
                                 children: childs.result};
                            
                 response.children.forEach(function(child){
                    if (!_tree.nodes(d)[0]._children){
                        _tree.nodes(d)[0]._children = [];
                    }
                    child.x  = d.x;
                    child.y  = d.y;
                    child.x0 = d.x0;
                    child.y0 = d.y0;
                    _tree.nodes(d)[0]._children.push(child);
                 });    
                 
                 if (d.children) {
                    _callerNode = d;
                    _callerMode = 0;     // Collapse
                    d._children = d.children;
                    d.children = null;
                 } else {
                    _callerNode = null;
                    _callerMode = 1;     // Expand
                    d.children = d._children;
                    d._children = null;
                 }
                 update(d);
              });
           } else {
              if (d.children) {
                 _callerNode = d;
                  _callerMode = 0;     // Collapse
                  d._children = d.children;
                  d.children = null;
              } else {
                 _callerNode = d;
                 _callerMode = 1;     // Expand             
                  d.children = d._children;
                  d._children = null;
              }
              update(d);
           }
        },
        //Redraw for zoom
        redraw = function() {
          _svg.attr("transform", "translate(" + d3.event.translate + ")" + 
                                 " scale(" + d3.event.scale.toFixed(1) + ")");
        },
        initiateDrag = function(d, domNode) {
            draggingNode = d;
            d3.select(domNode).select('.ghostCircle').attr('pointer-events', 'none');
            d3.selectAll('.ghostCircle').attr('class', 'ghostCircle show');
            d3.select(domNode).attr('class', 'node activeDrag');
    
            _svg.selectAll("g.node").sort(function(a, b) { // select the parent and sort the path's
                if (a.id != draggingNode.id) return 1; // a is not the hovered element, send "a" to the back
                else return -1; // a is the hovered element, bring "a" to the front
            });
            // if nodes has children, remove the links and nodes
            if (_nodes.length > 1) {
                // remove link paths
                links = tree.links(_nodes);
                nodePaths = _svg.selectAll("path.link")
                    .data(links, function(d) {
                        return d.target.id;
                    }).remove();
                // remove child nodes
                nodesExit = _svg.selectAll("g.node")
                    .data(_nodes, function(d) {
                        return d.id;
                    }).filter(function(d, i) {
                        if (d.id == draggingNode.id) {
                            return false;
                        }
                        return true;
                    }).remove();
            }
    
            // remove parent link
            parentLink = _tree.links(_tree.nodes(draggingNode.parent));
            _svg.selectAll('path.link').filter(function(d, i) {
                if (d.target.id == draggingNode.id) {
                    return true;
                }
                return false;
            }).remove();
    
            dragStarted = null;
        },
        endDrag = function() {
            selectedNode = null;
            d3.selectAll('.ghostCircle').attr('class', 'ghostCircle');
            d3.select(domNode).attr('class', 'node');
            // now restore the mouseover event or we won't be able to drag a 2nd time
            d3.select(domNode).select('.ghostCircle').attr('pointer-events', '');
            updateTempConnector();
            if (draggingNode !== null) {
                update(_root);
           //     centerNode(draggingNode);
                draggingNode = null;
            }
        },
        overCircle = function(d) {
            selectedNode = d;
            updateTempConnector();
        },
        outCircle = function(d) {
            selectedNode = null;
            updateTempConnector();
        },
        updateTempConnector = function() {
            var data = [];
            if (draggingNode !== null && selectedNode !== null) {
                // have to flip the source coordinates since we did this for the existing connectors on the original tree
                data = [{
                    source: {
                        x: selectedNode.y0,
                        y: selectedNode.x0
                    },
                    target: {
                        x: draggingNode.y0,
                        y: draggingNode.x0
                    }
                }];
            }
            var link = _svg.selectAll(".templink").data(data);
    
            link.enter().append("path")
                .attr("class", "templink")
                .attr("d", d3.svg.diagonal())
                .attr('pointer-events', 'none');
    
            link.attr("d", d3.svg.diagonal());
    
            link.exit().remove();
        },
        centerNode = function(source) {
            scale = zoomListener.scale();
            x = -source.y0;
            y = -source.x0;
            x = x * scale + viewerWidth / 2;
            y = y * scale + viewerWidth / 2;
            d3.select('g').transition()
                .duration(_duration)
                .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
            zoomListener.scale(scale);
            zoomListener.translate([x, y]);
        },
        zoom = function() {
            svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        },
        initTree = function(options) {
           var u_opts = $.extend({id: "",
                                  data: {}, 
                                  modus: "line", 
                                  loadFunc: function() {}
                                 },
                                 options),
           id = u_opts.id;
           
           _loadFunction = u_opts.loadFunc;
           _mode = u_opts.modus;
           _root = u_opts.data;

            viewerWidth = $(document).width();
            viewerHeight = $(document).height();
        
           if(_mode == "line") {
              _fixedDepth = 80;
           } else {
              _fixedDepth = 110;
           }

           zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);

           dragListener = d3.behavior.drag()
           .on("dragstart", function(d) {
               if (d == _root) {
                   return;
               }
               dragStarted = true;
               _nodes = _tree.nodes(d);
               d3.event.sourceEvent.stopPropagation();
               // it's important that we suppress the mouseover event on the node being dragged. Otherwise it will absorb the mouseover event and the underlying node will not detect it d3.select(this).attr('pointer-events', 'none');
           })
           .on("drag", function(d) {
               if (d == _root) {
                   return;
               }
               if (dragStarted) {
                   domNode = this;
                   initiateDrag(d, domNode);
               }

               // get coords of mouseEvent relative to svg container to allow for panning
               relCoords = d3.mouse($('svg').get(0));
               if (relCoords[0] < panBoundary) {
                   panTimer = true;
                   pan(this, 'left');
               } else if (relCoords[0] > ($('svg').width() - panBoundary)) {

                   panTimer = true;
                   pan(this, 'right');
               } else if (relCoords[1] < panBoundary) {
                   panTimer = true;
                   pan(this, 'up');
               } else if (relCoords[1] > ($('svg').height() - panBoundary)) {
                   panTimer = true;
                   pan(this, 'down');
               } else {
                   try {
                       clearTimeout(panTimer);
                   } catch (e) {

                   }
               }

               d.x0 += d3.event.dy;
               d.y0 += d3.event.dx;
               var node = d3.select(this);
               node.attr("transform", "translate(" + d.y0 + "," + d.x0 + ")");
               updateTempConnector();
           })
           .on("dragend", function(d) {
               if (d == _root) {
                   return;
               }
               domNode = this;
               if (selectedNode) {
                   // now remove the element from the parent, and insert it into the new elements children
                   var index = draggingNode.parent.children.indexOf(draggingNode);
                   if (index > -1) {
                       draggingNode.parent.children.splice(index, 1);
                   }
                   if (typeof selectedNode.children !== 'undefined' || typeof selectedNode._children !== 'undefined') {
                       if (typeof selectedNode.children !== 'undefined') {
                           selectedNode.children.push(draggingNode);
                       } else {
                           selectedNode._children.push(draggingNode);
                       }
                   } else {
                       selectedNode.children = [];
                       selectedNode.children.push(draggingNode);
                   }
                   // Make sure that the node being added to is expanded so user can see added node is correctly moved
                   expand(selectedNode);
                //   sortTree();
                   endDrag();
               } else {
                   endDrag();
               }
           });

        
           $(id).html("");   // Reset
           var width  = $(id).innerWidth()  - _margin.left - _margin.right,
               height = $(id).innerHeight() - _margin.top  - _margin.bottom;
           _tree = d3.layout.tree().nodeSize([_rectW + _rectSpacing, _rectH + _rectSpacing]);
           /* Basic Setup for the diagonal function. _mode = "diagonal" */
           _diagonal = d3.svg.diagonal()
               .projection(function (d) {
               return [d.x + _rectW / 2, d.y + _rectH / 2];
           });
           /* Basic setup for the line function. _mode = "line" */
           _lineFunction = d3.svg.line()
                                .x(function(d) { return d.x; })
                                .y(function(d) { return d.y; })
                                .interpolate("linear");
           var u_childwidth = parseInt((_root.children.length * _rectW) / 2);
           _svgroot = d3.select(id).append("svg").attr("width", width).attr("height", height)
                        .call(zm = d3.behavior.zoom().scaleExtent([0.15,3]).on("zoom", redraw));
               
           _svg = _svgroot.append("g")
                          .attr("transform", "translate(" + parseInt(u_childwidth + ((width - u_childwidth * 2) / 2) - _margin.left / 2) + "," + 20 + ")");
          
           var u_stops = [{offset: "0%", color: "#8BC34A", opacity: 1}, {offset: "100%", color: "#689F38", opacity: 1}];
           defLinearGradient("gradientchilds", "0%", "0%", "0%" ,"100%", u_stops);
           
           defBoxShadow("boxShadow");
           
           //necessary so that zoom knows where to zoom and unzoom from
           zm.translate([parseInt(u_childwidth + ((width - u_childwidth * 2) / 2) - _margin.left / 2), 20]);
           _root.x0 = 0;           // the root is already centered
           _root.y0 = height / 2;  // draw & animate from center
           _root.children.forEach(collapse);
           update(_root);
           d3.select(id).style("height", height + _margin.top + _margin.bottom);

        };
        return { initTree: initTree};
})();

function loadTree(){
    orgChart.initTree({id: "#tree-container", data: treeData, modus: "line", loadFunc: loadChilds});
}

function loadChilds(){

}