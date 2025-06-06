from manim import *
class GeneratedScene(Scene):
    def construct(self):
        text = Text("Hello, Manim!")
        self.play(Write(text))
        self.wait(1)