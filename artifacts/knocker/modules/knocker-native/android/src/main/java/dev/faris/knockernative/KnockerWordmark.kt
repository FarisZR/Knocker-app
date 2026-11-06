package dev.faris.knockernative

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.graphics.PathParser

/** Original vector wordmark, rendered natively with theme-aware lettering and its gold dot. */
@Composable
internal fun KnockerWordmark() {
  val path = remember { requireNotNull(PathParser.createPathFromPathData(WORDMARK_PATH)).asComposePath() }
  val foreground = MaterialTheme.colorScheme.onSurface
  Canvas(Modifier.size(208.dp, 36.dp).semantics { contentDescription = "Knocker"; heading() }) {
    withTransform({
      scale(size.width / 204.67189f, size.height / 35.55994f, pivot = Offset.Zero)
      translate(-3.5522995f, -148.19943f)
    }) {
      drawPath(path, foreground)
      drawCircle(Color(0xFFFDE562), 4.9190621f, Offset(203.30513f, 157.00136f))
    }
  }
}

private const val WORDMARK_PATH = "m 3.5523266,183.75937 v -35.56 h 4.5719999 v 15.494 h 8.3819995 l 9.5504,-15.494 h 5.3848 l -10.668,16.764 11.43,18.796 h -5.2832 l -9.7028,-16.002 H 8.1243265 v 16.002 z m 32.0039554,0 v -28.448 h 20.828 l 4.572,4.572 v 23.876 h -4.572 v -24.384 h -16.256 v 24.384 z m 31.242045,-4.572 v -19.304 l 4.572,-4.572 h 15.747999 l 4.572,4.572 v 19.304 l -4.572,4.572 H 71.370327 Z m 4.572,0.508 h 15.747999 v -20.32 H 71.370327 Z m 25.908018,-0.508 v -19.304 l 4.572005,-4.572 h 18.79599 v 4.064 h -18.79599 v 20.32 h 18.79599 v 4.064 h -18.79599 z m 27.939995,4.572 v -35.56 h 4.572 v 18.7452 h 9.0424 l 7.62,-11.6332 h 5.2324 l -8.9408,13.1064 9.398,15.3416 h -5.1816 l -7.6708,-12.7508 h -9.4996 v 12.7508 z m 29.21001,-4.572 v -19.304 l 4.572,-4.572 h 19.812 v 15.748 h -19.812 v 8.636 h 18.796 v 4.064 h -18.796 z m 4.572,-11.684 15.4432,-0.508 v -7.62 h -15.4432 z m 25.654,16.256 v -23.876 l 4.572,-4.572 h 15.24 v 4.064 h -15.24 v 24.384 z"
