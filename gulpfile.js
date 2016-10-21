var gulp = require('gulp');
var sass = require('gulp-sass');
var nodemon = require('gulp-nodemon');


// Run sass preprocessor.
gulp.task('sass', function(){
  return gulp.src('static/scss/**/*.scss')
    .pipe(sass())
    .pipe(gulp.dest('static/css'))
});

// Watch for changes.
gulp.task('watch', function(){
  gulp.watch('static/scss/**/*.scss', ['sass']);
})

// Run server.
gulp.task('server', ['sass'], function (cb) {
  nodemon({
    script: 'index.js',
  });
})

gulp.task('default', ['watch', 'server']);
