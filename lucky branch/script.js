const ctx = document.getElementById('chart');

new Chart(ctx, {
    type: 'line',
    data: {
        labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
        datasets: [{
            label: 'Income (Rs)',
            data: [8200, 8400, 9600, 8800, 8900, 9000],
            borderWidth: 2
        }]
    },
    options: {
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return 'Rs ' + context.raw;
                    }
                }
            }
        }
    }
});