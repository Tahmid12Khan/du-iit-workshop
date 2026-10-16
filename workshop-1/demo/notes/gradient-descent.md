# Gradient descent notes
Gradient descent is a way to train a model by making small steps that reduce the loss.
1. Start with random weights.
2. Compute the loss on a batch of training data.
3. Compute the gradient: the direction in which the loss grows fastest.
4. Move the weights a small step in the opposite direction. The step size is the learning rate.
5. Repeat until the loss stops improving.

Learning rate too large: the loss jumps around or grows.
Learning rate too small: training is slow and may get stuck.
Adam, RMSprop and momentum are common variants that adapt the step size.
Mini-batches give a noisy but cheap estimate of the gradient, so each step is fast.
Remember to normalise inputs, because features with large ranges make the loss surface stretched and slow to optimise.
Overfitting: the training loss keeps falling but the validation loss rises. Stop early or add regularisation.
